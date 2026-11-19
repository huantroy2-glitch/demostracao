// Raw keyboard/mouse state. Events only record; the game loop reads and consumes.
export type InputState = {
  keys: Set<string>;
  pressed: Set<string>;
  mouseDX: number;
  mouseDY: number;
  wheel: number;
  locked: boolean;
  dragging: boolean;
  lastMouseTime: number;
};

export const createInput = (): InputState => ({
  keys: new Set(),
  pressed: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  wheel: 0,
  locked: false,
  dragging: false,
  lastMouseTime: 0,
});

const GAME_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "KeyC",
  "ControlLeft",
  "KeyQ",
  "KeyE",
  "KeyH",
]);

export function attachInput(input: InputState, el: HTMLElement, onLockChange: (locked: boolean) => void) {
  const down = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => input.keys.delete(e.code);
  const blur = () => input.keys.clear();
  const move = (e: MouseEvent) => {
    if (input.locked || input.dragging) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
      input.lastMouseTime = performance.now();
    }
  };
  const mdown = (e: MouseEvent) => {
    if (e.button === 0 && !input.locked) input.dragging = true;
  };
  const mup = () => (input.dragging = false);
  const wheel = (e: WheelEvent) => {
    input.wheel += Math.sign(e.deltaY);
  };
  const lockChange = () => {
    input.locked = document.pointerLockElement === el;
    onLockChange(input.locked);
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  window.addEventListener("mousemove", move);
  el.addEventListener("mousedown", mdown);
  window.addEventListener("mouseup", mup);
  el.addEventListener("wheel", wheel, { passive: true });
  document.addEventListener("pointerlockchange", lockChange);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    window.removeEventListener("mousemove", move);
    el.removeEventListener("mousedown", mdown);
    window.removeEventListener("mouseup", mup);
    el.removeEventListener("wheel", wheel);
    document.removeEventListener("pointerlockchange", lockChange);
  };
}

export function consume(input: InputState, ...codes: string[]) {
  let hit = false;
  for (const c of codes) if (input.pressed.delete(c)) hit = true;
  return hit;
}

export const held = (input: InputState, ...codes: string[]) => codes.some((c) => input.keys.has(c));
