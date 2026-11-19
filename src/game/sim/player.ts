// Player controller: modes, movement, jumping, rolling, crouching, swimming, sitting.
import { PLAYER } from "./constants";
import { clamp, damp, dampAngle, wrapAngle } from "./math";
import { resolveBoxes, supportHeight } from "./collision";
import { terrainHeight, waterSurfaceAt, type Box } from "./world";

export type PlayerMode = "ground" | "air" | "roll" | "land" | "swim" | "climb" | "sit" | "action";

export type PlayerAnim =
  | "move"
  | "crouch"
  | "jumpStart"
  | "air"
  | "land"
  | "hardLand"
  | "roll"
  | "sitEnter"
  | "sitIdle"
  | "sitExit"
  | "swim"
  | "climb"
  | "interact"
  | "pickup";

export type PlayerEvent = "jump" | "land" | "hardLand" | "roll" | "splash" | "climb" | "step";

export type PlayerInput = {
  /** Strafe axis, +1 = right (D). */
  moveX: number;
  /** Forward axis, +1 = forward (W). */
  moveY: number;
  /** Camera orbit yaw: the camera sits at +sin/+cos of this angle behind the player. */
  camYaw: number;
  run: boolean;
  crouchPressed: boolean;
  jumpPressed: boolean;
  rollPressed: boolean;
  interactPressed: boolean;
};

export const emptyInput = (): PlayerInput => ({
  moveX: 0,
  moveY: 0,
  camYaw: 0,
  run: false,
  crouchPressed: false,
  jumpPressed: false,
  rollPressed: false,
  interactPressed: false,
});

export type SitState = { x: number; z: number; y: number; facing: number; phase: "enter" | "idle" | "exit"; t: number };

export type PlayerState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  mode: PlayerMode;
  crouch: boolean;
  runTime: number;
  sprinting: boolean;
  coyote: number;
  jumpBuffer: number;
  jumped: boolean;
  airTime: number;
  timer: number;
  rollCooldown: number;
  landOverlay: number;
  anim: PlayerAnim;
  animSerial: number;
  speed: number;
  /** Signed yaw rate, used for leaning into turns. */
  turnRate: number;
  sit: SitState | null;
  climb: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number } | null;
  actionAnim: "interact" | "pickup";
  events: PlayerEvent[];
};

export const SIT_ENTER_TIME = 1.1;
export const SIT_EXIT_TIME = 0.9;
/** Distance from bench centre (towards its front) where the feet go while seated. */
export const SIT_FOOT_OFFSET = 0.42;

export function createPlayer(x: number, z: number, facing: number): PlayerState {
  return {
    x,
    y: terrainHeight(x, z),
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    facing,
    mode: "ground",
    crouch: false,
    runTime: 0,
    sprinting: false,
    coyote: 0,
    jumpBuffer: 0,
    jumped: false,
    airTime: 0,
    timer: 0,
    rollCooldown: 0,
    landOverlay: 0,
    anim: "move",
    animSerial: 0,
    speed: 0,
    turnRate: 0,
    sit: null,
    climb: null,
    actionAnim: "interact",
    events: [],
  };
}

export const playerHeight = (p: PlayerState) => (p.crouch ? PLAYER.CROUCH_HEIGHT : PLAYER.HEIGHT);

/** Camera-relative input direction on the ground plane (length 0..1). */
export function inputDirection(input: PlayerInput): [number, number, number] {
  const fx = -Math.sin(input.camYaw);
  const fz = -Math.cos(input.camYaw);
  const rx = Math.cos(input.camYaw);
  const rz = -Math.sin(input.camYaw);
  let dx = fx * input.moveY + rx * input.moveX;
  let dz = fz * input.moveY + rz * input.moveX;
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  return [dx, dz, Math.min(len, 1)];
}

function moveHorizontal(p: PlayerState, boxes: Box[], dt: number) {
  const r = PLAYER.RADIUS;
  const feet = p.y;
  const reach = feet + PLAYER.STEP_OFFSET;
  let blockedHigh: number | null = null;
  const nx = p.x + p.vx * dt;
  if (p.vx !== 0) {
    const ahead = terrainHeight(nx + Math.sign(p.vx) * r, p.z);
    if (ahead > reach) {
      blockedHigh = ahead;
      p.vx = 0;
    } else p.x = nx;
  }
  const nz = p.z + p.vz * dt;
  if (p.vz !== 0) {
    const ahead = terrainHeight(p.x, nz + Math.sign(p.vz) * r);
    if (ahead > reach) {
      blockedHigh = Math.max(blockedHigh ?? -Infinity, ahead);
      p.vz = 0;
    } else p.z = nz;
  }
  resolveBoxes(boxes, p, r, feet, playerHeight(p));
  return blockedHigh;
}

function setAnim(p: PlayerState, anim: PlayerAnim) {
  if (p.anim !== anim) {
    p.anim = anim;
    p.animSerial++;
  }
}

function enterSwim(p: PlayerState, surface: number) {
  p.mode = "swim";
  p.crouch = false;
  p.vy = 0;
  p.y = surface - PLAYER.SWIM_FEET_DEPTH;
  p.vx *= 0.4;
  p.vz *= 0.4;
  p.events.push("splash");
}

function checkWater(p: PlayerState) {
  const surface = waterSurfaceAt(p.x, p.z);
  if (surface === null) return false;
  const depth = surface - terrainHeight(p.x, p.z);
  if (depth > PLAYER.SWIM_ENTER_DEPTH && p.y < surface - PLAYER.SWIM_FEET_DEPTH + 0.2) {
    enterSwim(p, surface);
    return true;
  }
  return false;
}

export function startSit(p: PlayerState, benchX: number, benchZ: number, facing: number, seatY: number) {
  p.mode = "sit";
  p.crouch = false;
  p.vx = p.vz = p.vy = 0;
  p.sit = {
    x: benchX + Math.sin(facing) * SIT_FOOT_OFFSET,
    z: benchZ + Math.cos(facing) * SIT_FOOT_OFFSET,
    y: seatY,
    facing,
    phase: "enter",
    t: 0,
  };
}

export function startAction(p: PlayerState, kind: "interact" | "pickup", faceX: number, faceZ: number) {
  p.mode = "action";
  p.timer = PLAYER.ACTION_TIME;
  p.actionAnim = kind;
  p.vx = p.vz = 0;
  p.crouch = false;
  const dx = faceX - p.x;
  const dz = faceZ - p.z;
  if (dx * dx + dz * dz > 1e-4) p.facing = p.facing + wrapAngle(Math.atan2(dx, dz) - p.facing);
}

/** Advances the player by one frame. `dt` must already be clamped by the caller. */
export function stepPlayer(p: PlayerState, input: PlayerInput, boxes: Box[], dt: number) {
  const [dx, dz, amount] = inputDirection(input);
  const moving = amount > 0.1;
  const prevFacing = p.facing;

  p.rollCooldown = Math.max(0, p.rollCooldown - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.landOverlay = Math.max(0, p.landOverlay - dt);
  if (input.jumpPressed) p.jumpBuffer = PLAYER.JUMP_BUFFER;

  switch (p.mode) {
    case "sit": {
      const s = p.sit!;
      s.t += dt;
      if (s.phase === "enter") {
        const k = clamp(s.t / 0.35, 0, 1);
        p.x = damp(p.x, s.x, 14, dt);
        p.z = damp(p.z, s.z, 14, dt);
        p.facing = dampAngle(p.facing, s.facing, 14, dt);
        if (k >= 1) {
          p.x = s.x;
          p.z = s.z;
        }
        if (s.t >= SIT_ENTER_TIME) {
          s.phase = "idle";
          s.t = 0;
        }
        setAnim(p, "sitEnter");
      } else if (s.phase === "idle") {
        setAnim(p, "sitIdle");
        if (input.interactPressed || moving || input.jumpPressed) {
          s.phase = "exit";
          s.t = 0;
        }
      } else {
        setAnim(p, "sitExit");
        if (s.t >= SIT_EXIT_TIME) {
          p.mode = "ground";
          p.sit = null;
        }
      }
      p.speed = 0;
      p.turnRate = 0;
      return;
    }
    case "action": {
      p.timer -= dt;
      setAnim(p, p.actionAnim);
      if (p.timer <= 0) p.mode = "ground";
      p.speed = 0;
      p.turnRate = 0;
      return;
    }
    case "climb": {
      const c = p.climb!;
      p.timer += dt;
      const k = clamp(p.timer / PLAYER.CLIMB_TIME, 0, 1);
      const e = k * k * (3 - 2 * k);
      p.x = c.fx + (c.tx - c.fx) * e;
      p.z = c.fz + (c.tz - c.fz) * e;
      p.y = c.fy + (c.ty - c.fy) * Math.min(1, e * 1.6);
      setAnim(p, "climb");
      if (k >= 1) {
        p.mode = "ground";
        p.climb = null;
        p.landOverlay = PLAYER.LAND_TIME;
        p.vx = p.vz = p.vy = 0;
      }
      p.speed = 0;
      return;
    }
    case "swim": {
      const surface = waterSurfaceAt(p.x, p.z);
      const target = (input.run ? PLAYER.SWIM_FAST_SPEED : PLAYER.SWIM_SPEED) * amount;
      p.vx = damp(p.vx, dx * target, 3, dt);
      p.vz = damp(p.vz, dz * target, 3, dt);
      if (moving) p.facing = dampAngle(p.facing, Math.atan2(dx, dz), 5, dt);
      const blocked = moveHorizontal(p, boxes, dt);
      if (surface !== null) p.y = damp(p.y, surface - PLAYER.SWIM_FEET_DEPTH, 8, dt);
      // Pull up onto the edge when swimming into it.
      if (blocked !== null && moving && blocked - p.y <= PLAYER.CLIMB_OUT_MAX) {
        p.mode = "climb";
        p.timer = 0;
        p.climb = { fx: p.x, fy: p.y, fz: p.z, tx: p.x + dx * 0.75, ty: blocked, tz: p.z + dz * 0.75 };
        p.events.push("climb");
        setAnim(p, "climb");
        return;
      }
      const floor = terrainHeight(p.x, p.z);
      if (surface === null || surface - floor < PLAYER.SWIM_ENTER_DEPTH - 0.1) {
        // Walked out up the steps.
        p.mode = "ground";
        p.y = Math.max(p.y, floor);
      }
      p.speed = Math.hypot(p.vx, p.vz);
      setAnim(p, "swim");
      return;
    }
  }

  const grounded = p.mode === "ground" || p.mode === "land";

  // Crouch toggle (C / Ctrl).
  if (input.crouchPressed && grounded) p.crouch = !p.crouch;

  // Roll / dodge.
  if (input.rollPressed && grounded && p.rollCooldown <= 0) {
    p.mode = "roll";
    p.timer = PLAYER.ROLL_DURATION;
    p.crouch = false;
    if (moving) p.facing = Math.atan2(dx, dz);
    p.events.push("roll");
  }

  if (p.mode === "roll") {
    p.timer -= dt;
    const k = 1 - p.timer / PLAYER.ROLL_DURATION;
    const sp = PLAYER.ROLL_SPEED * (k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25 * 0.7);
    p.vx = Math.sin(p.facing) * sp;
    p.vz = Math.cos(p.facing) * sp;
    if (p.timer <= 0) {
      p.mode = "ground";
      p.rollCooldown = PLAYER.ROLL_COOLDOWN;
    }
  } else if (grounded) {
    if (p.mode === "land") {
      p.timer -= dt;
      if (p.timer <= 0) p.mode = "ground";
    }
    if (input.run && moving && !p.crouch) p.runTime += dt;
    else p.runTime = 0;
    p.sprinting = p.runTime > PLAYER.SPRINT_DELAY;
    let target = p.crouch
      ? PLAYER.CROUCH_SPEED
      : input.run
        ? p.sprinting
          ? PLAYER.SPRINT_SPEED
          : PLAYER.RUN_SPEED
        : PLAYER.WALK_SPEED;
    if (p.mode === "land") target *= 0.25;
    target *= amount;
    if (moving) {
      const want = Math.atan2(dx, dz);
      const diff = Math.abs(wrapAngle(want - p.facing));
      // Slow down while turning sharply so the body turns before it runs.
      target *= clamp(0.35 + 0.65 * Math.cos(diff), 0.3, 1);
      p.facing = dampAngle(p.facing, want, PLAYER.TURN_RATE, dt);
    }
    const rate = moving ? PLAYER.GROUND_ACCEL : PLAYER.GROUND_DECEL;
    p.vx = damp(p.vx, dx * target, rate, dt);
    p.vz = damp(p.vz, dz * target, rate, dt);

    if (p.jumpBuffer > 0 && p.mode === "ground") {
      if (p.crouch) {
        p.crouch = false;
        p.jumpBuffer = 0;
      } else {
        p.vy = PLAYER.JUMP_VELOCITY;
        p.mode = "air";
        p.jumped = true;
        p.airTime = 0;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.events.push("jump");
      }
    }
  } else if (p.mode === "air") {
    // Limited air control.
    const target = Math.max(Math.hypot(p.vx, p.vz), PLAYER.WALK_SPEED) * amount;
    if (moving) {
      p.vx = damp(p.vx, dx * target, PLAYER.AIR_ACCEL, dt);
      p.vz = damp(p.vz, dz * target, PLAYER.AIR_ACCEL, dt);
      p.facing = dampAngle(p.facing, Math.atan2(dx, dz), PLAYER.TURN_RATE * 0.4, dt);
    }
    p.coyote = Math.max(0, p.coyote - dt);
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = PLAYER.JUMP_VELOCITY;
      p.jumped = true;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.events.push("jump");
    }
  }

  moveHorizontal(p, boxes, dt);

  // Vertical.
  const support = supportHeight(boxes, p.x, p.z, PLAYER.RADIUS, p.y);
  if (p.mode !== "air") {
    if (support >= p.y - PLAYER.STEP_DOWN) {
      if (support > p.y + 0.05) p.events.push("step");
      p.y = support;
      p.vy = 0;
    } else {
      p.mode = "air";
      p.jumped = false;
      p.airTime = 0;
      p.coyote = PLAYER.COYOTE;
      p.vy = 0;
    }
  }
  if (p.mode === "air") {
    p.airTime += dt;
    p.vy -= (p.vy > 0 ? PLAYER.GRAVITY_UP : PLAYER.GRAVITY_DOWN) * dt;
    p.vy = Math.max(p.vy, -PLAYER.MAX_FALL);
    p.y += p.vy * dt;
    const below = supportHeight(boxes, p.x, p.z, PLAYER.RADIUS, Math.max(p.y, support));
    if (p.y <= below && p.vy <= 0) {
      const impact = -p.vy;
      p.y = below;
      p.vy = 0;
      if (impact > PLAYER.HARD_LAND_SPEED) {
        p.mode = "land";
        p.timer = PLAYER.HARD_LAND_TIME;
        p.events.push("hardLand");
      } else {
        p.mode = "ground";
        if (Math.hypot(p.vx, p.vz) < 2.2) p.landOverlay = PLAYER.LAND_TIME;
        p.events.push("land");
      }
    }
    checkWater(p);
  }

  p.speed = Math.hypot(p.vx, p.vz);
  p.turnRate = dt > 0 ? wrapAngle(p.facing - prevFacing) / dt : 0;

  switch (p.mode) {
    case "roll":
      setAnim(p, "roll");
      break;
    case "air":
      setAnim(p, p.jumped && p.airTime < 0.28 ? "jumpStart" : "air");
      break;
    case "land":
      setAnim(p, "hardLand");
      break;
    default:
      setAnim(p, p.crouch ? "crouch" : p.landOverlay > 0 ? "land" : "move");
  }
}
