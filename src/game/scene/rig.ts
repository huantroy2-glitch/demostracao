// Character rig: clones the shared body, dresses it, and blends animation clips by state and speed.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PLAYER } from "../sim/constants";
import { damp } from "../sim/math";
import type { PlayerAnim } from "../sim/player";
import { buildOutfitGeometry, makeOutfitMaterial, type Outfit } from "./outfits";

export type RigAnim = PlayerAnim | "idle" | "talk" | "dance";

export type RigDrive = {
  anim: RigAnim;
  serial: number;
  speed: number;
  turnRate: number;
  sprinting: boolean;
};

const CLIPS = {
  idle: "Idle_Loop",
  walk: "Walk_Loop",
  jog: "Jog_Fwd_Loop",
  sprint: "Sprint_Loop",
  crouchIdle: "Crouch_Idle_Loop",
  crouchWalk: "Crouch_Fwd_Loop",
  jumpStart: "Jump_Start",
  jumpLoop: "Jump_Loop",
  land: "Jump_Land",
  roll: "Roll",
  sitEnter: "Sitting_Enter",
  sitIdle: "Sitting_Idle_Loop",
  sitExit: "Sitting_Exit",
  swimIdle: "Swim_Idle_Loop",
  swim: "Swim_Fwd_Loop",
  interact: "Interact",
  pickup: "PickUp_Table",
  talk: "Idle_Talking_Loop",
  dance: "Dance_Loop",
} as const;
type ClipKey = keyof typeof CLIPS;
const KEYS = Object.keys(CLIPS) as ClipKey[];

/** One-shot clips: [start offset in seconds, playback speed]. */
const ONE_SHOT: Partial<Record<ClipKey, [number, number]>> = {
  jumpStart: [0.45, 1.4],
  land: [0.25, 1.5],
  roll: [0.05, 1.6],
  sitEnter: [0, 1],
  sitExit: [0, 1.1],
  interact: [0.2, 1.7],
  pickup: [0, 1.1],
};

/** Native ground speed of each locomotion clip (m/s); playback is scaled to match the real speed. */
const LOCO: [ClipKey, number][] = [
  ["walk", PLAYER.WALK_SPEED],
  ["jog", PLAYER.RUN_SPEED],
  ["sprint", PLAYER.SPRINT_SPEED],
];

/** Visual height offsets per animation (the body model's feet sit at the sim position otherwise). */
const Y_OFFSET: Partial<Record<RigAnim, number>> = { swim: 0.0 };

/** Remove root motion: linear drift on the horizontal axes of root/pelvis, and every other position/scale track. */
export function prepareClips(clips: THREE.AnimationClip[]) {
  const out = new Map<string, THREE.AnimationClip>();
  for (const src of clips) {
    const clip = src.clone();
    clip.tracks = clip.tracks.filter((t) => {
      if (t.name.endsWith(".scale")) return false;
      if (t.name.endsWith(".position")) return t.name.startsWith("root.") || t.name.startsWith("pelvis.");
      return true;
    });
    for (const t of clip.tracks) {
      if (!t.name.endsWith(".position")) continue;
      const v = t.values;
      const count = v.length / 3;
      if (count < 2) continue;
      const mean = [0, 0, 0];
      for (let i = 0; i < count; i++) for (let a = 0; a < 3; a++) mean[a] += Math.abs(v[i * 3 + a]) / count;
      const isRoot = t.name.startsWith("root.");
      const up = mean.indexOf(Math.max(...mean));
      const T = t.times[count - 1] - t.times[0] || 1;
      for (let a = 0; a < 3; a++) {
        if (!isRoot && a === up) continue;
        const start = v[a];
        const drift = v[(count - 1) * 3 + a] - start;
        for (let i = 0; i < count; i++) {
          const k = (t.times[i] - t.times[0]) / T;
          v[i * 3 + a] -= drift * k;
        }
      }
    }
    out.set(clip.name, clip);
  }
  return out;
}

export class CharacterRig {
  readonly group = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = {} as Record<ClipKey, THREE.AnimationAction>;
  private readonly weights = {} as Record<ClipKey, number>;
  private phase = 0;
  private serial = -1;
  private anim: RigAnim = "idle";
  private visualY: number | null = null;
  private bank = 0;
  private pitch = 0;

  constructor(body: THREE.Object3D, hair: THREE.Object3D, clips: Map<string, THREE.AnimationClip>, outfit: Outfit) {
    const root = cloneSkinned(body);
    root.updateMatrixWorld(true);
    let head: THREE.Object3D | null = null;
    root.traverse((o) => {
      if (o.name === "Head") head = o;
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.name === "SuperHero_Male") {
        mesh.geometry = buildOutfitGeometry(mesh, outfit);
        mesh.material = makeOutfitMaterial(m, outfit);
      } else if (mesh.name === "Eyebrows") {
        const mm = m.clone();
        mm.vertexColors = false;
        mm.color.set(outfit.hair);
        mesh.material = mm;
      } else {
        const mm = m.clone();
        mm.vertexColors = false;
        mesh.material = mm;
      }
    });
    if (head) {
      const h = hair.clone(true);
      h.updateMatrixWorld(true);
      const headBone = head as THREE.Object3D;
      const inv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
      h.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const local = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
        const piece = new THREE.Mesh(
          mesh.geometry,
          new THREE.MeshStandardMaterial({ color: outfit.hair, roughness: 0.95 }),
        );
        local.decompose(piece.position, piece.quaternion, piece.scale);
        piece.castShadow = true;
        headBone.add(piece);
      });
    }
    this.lean.add(root);
    this.lean.scale.set(outfit.bulk, 1, outfit.bulk);
    this.group.add(this.lean);

    this.mixer = new THREE.AnimationMixer(root);
    for (const key of KEYS) {
      const clip = clips.get(CLIPS[key]);
      if (!clip) throw new Error(`Missing animation clip ${CLIPS[key]}`);
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOT[key]) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      this.actions[key] = action;
      this.weights[key] = 0;
    }
    this.weights.idle = 1;
  }

  /** Called once per frame by the game stepper. */
  update(dt: number, d: RigDrive, x: number, y: number, z: number, facing: number) {
    if (d.serial !== this.serial || d.anim !== this.anim) {
      this.serial = d.serial;
      this.anim = d.anim;
      const key = this.oneShotKey(d.anim);
      if (key) {
        const [offset, speed] = ONE_SHOT[key]!;
        const a = this.actions[key];
        a.reset();
        a.time = offset;
        a.timeScale = speed;
        a.play();
      }
    }

    const target = {} as Record<ClipKey, number>;
    for (const k of KEYS) target[k] = 0;
    const s = d.speed;
    switch (d.anim) {
      case "move": {
        this.locomotion(target, s, dt);
        break;
      }
      case "crouch": {
        const k = Math.min(1, s / PLAYER.CROUCH_SPEED);
        target.crouchIdle = 1 - k;
        target.crouchWalk = k;
        this.actions.crouchWalk.timeScale = Math.max(0.3, s / PLAYER.CROUCH_SPEED);
        break;
      }
      case "swim": {
        const k = Math.min(1, s / PLAYER.SWIM_SPEED);
        target.swimIdle = 1 - k;
        target.swim = k;
        this.actions.swim.timeScale = Math.max(0.5, s / PLAYER.SWIM_SPEED);
        break;
      }
      case "air":
        target.jumpLoop = 1;
        break;
      case "hardLand":
      case "climb":
        target.land = 1;
        break;
      case "sitIdle":
        target.sitIdle = 1;
        break;
      case "idle":
        target.idle = 1;
        break;
      case "talk":
        target.talk = 1;
        break;
      case "dance":
        target.dance = 1;
        break;
      default: {
        const key = this.oneShotKey(d.anim);
        if (key) target[key] = 1;
      }
    }

    const fast = this.oneShotKey(d.anim) ? 16 : 9;
    let sum = 0;
    for (const k of KEYS) {
      this.weights[k] = damp(this.weights[k], target[k], fast, dt);
      if (this.weights[k] < 0.002) this.weights[k] = 0;
      sum += this.weights[k];
    }
    if (sum < 1e-4) {
      this.weights.idle = 1;
      sum = 1;
    }
    for (const k of KEYS) this.actions[k].setEffectiveWeight(this.weights[k] / sum);

    this.mixer.update(dt);

    // Body position: smooth upward steps (curbs, stairs), follow falls exactly.
    const yo = y + (Y_OFFSET[d.anim] ?? 0);
    if (this.visualY === null || yo < this.visualY || Math.abs(yo - this.visualY) > 1.2) this.visualY = yo;
    else this.visualY = damp(this.visualY, yo, 16, dt);
    this.group.position.set(x, this.visualY, z);
    this.group.rotation.set(0, facing, 0);

    // Lean into turns and forward when sprinting.
    const bankTarget = THREE.MathUtils.clamp(-d.turnRate * s * 0.012, -0.16, 0.16);
    this.bank = damp(this.bank, bankTarget, 6, dt);
    const pitchTarget = d.anim === "move" ? (d.sprinting ? 0.09 : s > 3 ? 0.035 : 0) : 0;
    this.pitch = damp(this.pitch, pitchTarget, 5, dt);
    this.lean.rotation.set(this.pitch, 0, this.bank);
  }

  private oneShotKey(anim: RigAnim): ClipKey | null {
    switch (anim) {
      case "jumpStart":
        return "jumpStart";
      case "land":
      case "hardLand":
      case "climb":
        return "land";
      case "roll":
        return "roll";
      case "sitEnter":
        return "sitEnter";
      case "sitExit":
        return "sitExit";
      case "interact":
        return "interact";
      case "pickup":
        return "pickup";
      default:
        return null;
    }
  }

  /** Speed-driven blend of idle / walk / jog / sprint with a shared foot phase. */
  private locomotion(target: Record<ClipKey, number>, s: number, dt: number) {
    const pts: [ClipKey, number][] = [["idle", 0], ...LOCO];
    if (s <= 0.05) target.idle = 1;
    else if (s >= pts[pts.length - 1][1]) target.sprint = 1;
    else {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ka, sa] = pts[i];
        const [kb, sb] = pts[i + 1];
        if (s >= sa && s <= sb) {
          const k = (s - sa) / (sb - sa);
          target[ka] = 1 - k;
          target[kb] = k;
          break;
        }
      }
    }
    // Advance one shared phase so blended clips keep their feet in step.
    let rate = 0;
    let wsum = 0;
    for (const [k, native] of LOCO) {
      const w = target[k];
      if (w <= 0) continue;
      rate += (w * (Math.max(s, 0.6) / native)) / this.actions[k].getClip().duration;
      wsum += w;
    }
    if (wsum > 0) this.phase = (this.phase + (rate / wsum) * dt) % 1;
    for (const [k] of LOCO) {
      const a = this.actions[k];
      a.timeScale = 0;
      a.time = this.phase * a.getClip().duration;
    }
  }
}
