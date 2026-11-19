import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { attachInput, consume, held } from "./input";
import { CAMERA, PLAYER } from "./sim/constants";
import { damp, dampAngle, clamp } from "./sim/math";
import { raycastBoxes } from "./sim/collision";
import { startAction, startSit, stepPlayer, type PlayerInput } from "./sim/player";
import { terrainHeight, type Interactable } from "./sim/world";
import { createGameState, type GameState } from "./state";
import { useUI } from "./store";
import { Actors } from "./scene/Actors";
import { Ground } from "./scene/Ground";
import { BoundaryWalls, Poles, Props } from "./scene/Props";
import { HomeDoor, Pickups, Water } from "./scene/Details";
import { GameHud } from "./Hud";

function InputBridge({ game }: { game: GameState }) {
  const { gl } = useThree();

  useEffect(() => {
    const detach = attachInput(game.input, gl.domElement, (locked) => useUI.getState().set({ locked }));
    return () => {
      detach();
      useUI.getState().set({ locked: false });
    };
  }, [game, gl]);

  return null;
}

function nearestInteraction(game: GameState): Interactable | null {
  const p = game.player;
  let nearest: Interactable | null = null;
  let best = PLAYER.INTERACT_RANGE * PLAYER.INTERACT_RANGE;

  for (const item of game.world.interactables) {
    if (item.kind === "pickup" && game.collected.has(item.id)) continue;
    const dx = item.x - p.x;
    const dz = item.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      nearest = item;
    }
  }
  return nearest;
}

function showNpcLine(game: GameState, npcId: string, index: number) {
  const npc = game.world.npcs.find((entry) => entry.id === npcId);
  if (!npc) return;
  const line = npc.lines[index];
  if (!line) return;
  useUI.getState().set({
    dialog: { name: npc.name, text: line, index: index + 1, total: npc.lines.length },
  });
}

function Runtime({ game }: { game: GameState }) {
  const { camera } = useThree();
  const hudClockAt = useRef(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const p = game.player;
    const input = game.input;
    const ui = useUI.getState();
    let focus: Interactable | null = game.focus;

    if (ui.started) {
      if (input.locked || input.dragging) {
        game.cam.yaw -= input.mouseDX * CAMERA.MOUSE_SENSITIVITY;
        game.cam.pitch = clamp(
          game.cam.pitch - input.mouseDY * CAMERA.MOUSE_SENSITIVITY,
          CAMERA.MIN_PITCH,
          CAMERA.MAX_PITCH,
        );
      }
      input.mouseDX = 0;
      input.mouseDY = 0;
      if (input.wheel !== 0) {
        game.cam.distance = clamp(
          game.cam.distance + input.wheel * 0.45,
          CAMERA.MIN_DISTANCE,
          CAMERA.MAX_DISTANCE,
        );
        input.wheel = 0;
      }

      focus = nearestInteraction(game);
      game.focus = focus;

      const wasTalking = game.talkingTo !== null;
      const escapePressed = consume(input, "Escape");
      const interactPressed = consume(input, "KeyE");
      if (escapePressed && game.talkingTo) {
        game.talkingTo = null;
        useUI.getState().set({ dialog: null });
      } else if (game.talkingTo && interactPressed) {
        const npc = game.world.npcs.find((entry) => entry.id === game.talkingTo);
        if (npc && game.dialogIndex + 1 < npc.lines.length) {
          game.dialogIndex += 1;
          showNpcLine(game, npc.id, game.dialogIndex);
        } else {
          game.talkingTo = null;
          game.dialogIndex = 0;
          useUI.getState().set({ dialog: null });
        }
      }

      let sitInteract = false;
      if (p.mode === "sit") {
        sitInteract = interactPressed;
      } else if (interactPressed && !wasTalking && !game.talkingTo && focus) {
        switch (focus.kind) {
          case "door":
            game.doorTarget = game.doorTarget > 0.5 ? 0 : 1;
            startAction(p, "interact", focus.x, focus.z);
            useUI.getState().set({
              toast: { text: game.doorTarget > 0.5 ? "A porta está a abrir" : "A porta está a fechar", id: Date.now() },
            });
            break;
          case "pickup":
            if (!game.collected.has(focus.id)) {
              game.collected.add(focus.id);
              game.money += focus.value;
              startAction(p, "pickup", focus.x, focus.z);
              useUI.getState().set({
                money: game.money,
                toast: { text: `+${focus.value.toLocaleString("pt-PT")} $ apanhados`, id: Date.now() },
              });
            }
            break;
          case "npc":
            game.talkingTo = focus.npcId;
            game.dialogIndex = 0;
            startAction(p, "interact", focus.x, focus.z);
            showNpcLine(game, focus.npcId, 0);
            break;
          case "bench":
            startSit(p, focus.x, focus.z, focus.facing, focus.seatY);
            break;
        }
      }

      if (consume(input, "KeyH")) {
        useUI.getState().set({ showHelp: !useUI.getState().showHelp });
      }

      const playerInput: PlayerInput = {
        moveX: Number(held(input, "KeyD", "ArrowRight")) - Number(held(input, "KeyA", "ArrowLeft")),
        moveY: Number(held(input, "KeyW", "ArrowUp")) - Number(held(input, "KeyS", "ArrowDown")),
        camYaw: game.cam.yaw,
        run: held(input, "ShiftLeft", "ShiftRight"),
        crouchPressed: consume(input, "KeyC", "ControlLeft"),
        jumpPressed: consume(input, "Space"),
        rollPressed: consume(input, "KeyQ"),
        interactPressed: sitInteract,
      };

      p.events.length = 0;
      stepPlayer(p, playerInput, game.world.boxes, dt);
      if (p.events.includes("hardLand")) game.cam.shake = 0.18;
      if (p.events.includes("splash")) {
        useUI.getState().set({ toast: { text: "Entraste na piscina", id: Date.now() } });
      }

      game.time += dt;
      game.clock = (18 * 60 + 5 + game.time * 1.25) % (24 * 60);
      if (game.time - hudClockAt.current > 0.35) {
        hudClockAt.current = game.time;
        useUI.getState().set({ clock: game.clock });
      }
    } else {
      input.mouseDX = 0;
      input.mouseDY = 0;
      input.wheel = 0;
    }

    game.doorOpen = damp(game.doorOpen, game.doorTarget, 4.5, dt);
    game.cam.shake = Math.max(0, game.cam.shake - dt * 0.8);

    const playerRig = game.rigs.get("player");
    playerRig?.update(
      dt,
      {
        anim: p.anim,
        serial: p.animSerial,
        speed: p.speed,
        turnRate: p.turnRate,
        sprinting: p.sprinting,
      },
      p.x,
      p.y,
      p.z,
      p.facing,
    );

    for (const npc of game.world.npcs) {
      const rig = game.rigs.get(`npc-${npc.id}`);
      const targetFacing =
        game.talkingTo === npc.id ? Math.atan2(p.x - npc.x, p.z - npc.z) : npc.facing;
      const facing = dampAngle(game.npcFacing[npc.id] ?? npc.facing, targetFacing, 5, dt);
      game.npcFacing[npc.id] = facing;
      rig?.update(
        dt,
        {
          anim: game.talkingTo === npc.id ? "talk" : npc.idle,
          serial: game.talkingTo === npc.id ? 1 : 0,
          speed: 0,
          turnRate: 0,
          sprinting: false,
        },
        npc.x,
        terrainHeight(npc.x, npc.z),
        npc.z,
        facing,
      );
    }

    const pivotY = p.y + (p.crouch ? CAMERA.CROUCH_PIVOT_HEIGHT : CAMERA.PIVOT_HEIGHT);
    game.cam.pivotX = damp(game.cam.pivotX, p.x, CAMERA.FOLLOW_RATE, dt);
    game.cam.pivotY = damp(game.cam.pivotY, pivotY, CAMERA.FOLLOW_RATE, dt);
    game.cam.pivotZ = damp(game.cam.pivotZ, p.z, CAMERA.FOLLOW_RATE, dt);

    const cosPitch = Math.cos(game.cam.pitch);
    const dir = new THREE.Vector3(
      Math.sin(game.cam.yaw) * cosPitch,
      Math.sin(game.cam.pitch),
      Math.cos(game.cam.yaw) * cosPitch,
    ).normalize();
    const pivot = new THREE.Vector3(game.cam.pivotX, game.cam.pivotY, game.cam.pivotZ);
    const desiredDistance = game.cam.distance;
    const hit = raycastBoxes(
      game.camBoxes,
      pivot.x,
      pivot.y,
      pivot.z,
      dir.x,
      dir.y,
      dir.z,
      desiredDistance,
    );
    const safeDistance = Number.isFinite(hit)
      ? Math.max(1.25, Math.min(desiredDistance, hit - CAMERA.COLLISION_PADDING))
      : desiredDistance;
    game.cam.current = damp(
      game.cam.current,
      safeDistance,
      safeDistance < game.cam.current ? 24 : CAMERA.RECOVER_RATE,
      dt,
    );

    const shake = game.cam.shake;
    const cameraPosition = pivot
      .clone()
      .addScaledVector(dir, game.cam.current)
      .add(new THREE.Vector3(Math.sin(game.time * 42) * shake, Math.cos(game.time * 35) * shake * 0.5, 0));
    camera.position.copy(cameraPosition);
    camera.lookAt(pivot);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== game.cam.fov) {
      camera.fov = game.cam.fov;
      camera.updateProjectionMatrix();
    }

    if (ui.prompt !== (focus && !game.talkingTo ? `Pressione E para ${focus.label}` : null)) {
      useUI.getState().set({
        prompt: focus && !game.talkingTo ? `Pressione E para ${focus.label}` : null,
      });
    }
  });

  return null;
}

function Scene({ game }: { game: GameState }) {
  const home = game.world.placements.find((p) => p.model === "house1" && p.x === 0 && p.z === -86);
  return (
    <>
      <color attach="background" args={["#d99b7d"]} />
      <fog attach="fog" args={["#d9a080", 42, 230]} />
      <Sky
        distance={450000}
        sunPosition={[-0.8, 0.1, -0.6]}
        turbidity={9}
        rayleigh={2.2}
        mieCoefficient={0.006}
        mieDirectionalG={0.82}
      />
      <hemisphereLight args={["#ffe1c5", "#4d4b46", 1.15]} />
      <ambientLight intensity={0.52} />
      <directionalLight
        castShadow
        position={[-72, 38, -98]}
        intensity={2.5}
        color="#ffc18e"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-camera-far={240}
        shadow-bias={-0.00015}
      />
      <InputBridge game={game} />
      <Runtime game={game} />
      <Ground />
      <Props world={game.world} homeId={home?.id ?? ""} />
      <Poles world={game.world} />
      <BoundaryWalls world={game.world} />
      <Water />
      <HomeDoor game={game} />
      <Pickups game={game} />
      <Actors game={game} />
    </>
  );
}

export function GameExperience() {
  const [game] = useState(() => createGameState());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startGame = () => {
    useUI.getState().set({ started: true, clock: game.clock });
    try {
      const lockRequest = canvasRef.current?.requestPointerLock();
      if (lockRequest && "catch" in lockRequest) void lockRequest.catch(() => undefined);
    } catch {
      // Pointer lock is optional; click-and-drag mouse look remains available.
    }
  };

  return (
    <main className="game-shell">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 62, near: 0.1, far: 500, position: [0, 3, 4] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
        }}
      >
        <Suspense fallback={null}>
          <Scene game={game} />
        </Suspense>
      </Canvas>
      <GameHud onStart={startGame} />
    </main>
  );
}
