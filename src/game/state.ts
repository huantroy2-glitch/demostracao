// Per-frame game state lives here, outside React. The scene reads it; only the stepper writes it.
import { buildWorld, SPAWN, type Box, type Interactable, type World } from "./sim/world";
import { createPlayer, type PlayerState } from "./sim/player";
import { CAMERA } from "./sim/constants";
import { createInput, type InputState } from "./input";
import type { CharacterRig } from "./scene/rig";

export type CameraState = {
  yaw: number;
  pitch: number;
  distance: number;
  current: number;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  shake: number;
  fov: number;
};

export type GameState = {
  world: World;
  camBoxes: Box[];
  player: PlayerState;
  input: InputState;
  cam: CameraState;
  rigs: Map<string, CharacterRig>;
  doorOpen: number;
  doorTarget: number;
  collected: Set<string>;
  npcFacing: Record<string, number>;
  talkingTo: string | null;
  dialogIndex: number;
  focus: Interactable | null;
  /** Minutes since midnight on the in-game clock. */
  clock: number;
  time: number;
  money: number;
  ready: boolean;
};

let current: GameState | null = null;

export function createGameState(): GameState {
  const world = buildWorld();
  const camBoxes = world.boxes.filter((b) => b.maxX - b.minX > 0.9 || b.maxZ - b.minZ > 0.9);
  const npcFacing: Record<string, number> = {};
  for (const n of world.npcs) npcFacing[n.id] = n.facing;
  current = {
    world,
    camBoxes,
    player: createPlayer(SPAWN.x, SPAWN.z, SPAWN.facing),
    input: createInput(),
    cam: {
      yaw: SPAWN.facing + Math.PI,
      pitch: 0.18,
      distance: CAMERA.DISTANCE,
      current: CAMERA.DISTANCE,
      pivotX: SPAWN.x,
      pivotY: CAMERA.PIVOT_HEIGHT,
      pivotZ: SPAWN.z,
      shake: 0,
      fov: 62,
    },
    rigs: new Map(),
    doorOpen: 0,
    doorTarget: 0,
    collected: new Set(),
    npcFacing,
    talkingTo: null,
    dialogIndex: 0,
    focus: null,
    clock: 18 * 60 + 5,
    time: 0,
    money: 0,
    ready: false,
  };
  return current;
}

export const getGame = () => current;
