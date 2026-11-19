import type { Box } from "./world";
import { terrainHeight } from "./world";
import { PLAYER } from "./constants";

/** Highest surface under the player's circle the feet can stand on (terrain or box tops within step reach). */
export function supportHeight(boxes: Box[], x: number, z: number, r: number, feetY: number) {
  let h = terrainHeight(x, z);
  const reach = feetY + PLAYER.STEP_OFFSET;
  const rr = r * 0.7;
  for (const bx of boxes) {
    if (bx.maxY > reach || bx.maxY <= h) continue;
    if (x + rr < bx.minX || x - rr > bx.maxX || z + rr < bx.minZ || z - rr > bx.maxZ) continue;
    h = bx.maxY;
  }
  return h;
}

/** Pushes a vertical cylinder out of every box it overlaps that is too tall to step onto. */
export function resolveBoxes(boxes: Box[], pos: { x: number; z: number }, r: number, feetY: number, height: number) {
  let hit = false;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const bx of boxes) {
      if (bx.maxY <= feetY + PLAYER.STEP_OFFSET || bx.minY >= feetY + height) continue;
      if (pos.x + r <= bx.minX || pos.x - r >= bx.maxX || pos.z + r <= bx.minZ || pos.z - r >= bx.maxZ) continue;
      const cx = Math.min(Math.max(pos.x, bx.minX), bx.maxX);
      const cz = Math.min(Math.max(pos.z, bx.minZ), bx.maxZ);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        const push = r - d;
        dx /= d;
        dz /= d;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // Centre inside the box: leave along the shallowest side.
        const left = pos.x - bx.minX + r;
        const right = bx.maxX - pos.x + r;
        const back = pos.z - bx.minZ + r;
        const front = bx.maxZ - pos.z + r;
        const m = Math.min(left, right, back, front);
        if (m === left) pos.x -= left;
        else if (m === right) pos.x += right;
        else if (m === back) pos.z -= back;
        else pos.z += front;
      }
      moved = true;
      hit = true;
    }
    if (!moved) break;
  }
  return hit;
}

/** Ray vs. boxes. Returns the nearest hit distance or Infinity. */
export function raycastBoxes(
  boxes: Box[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
) {
  let best = Infinity;
  const ix = 1 / (dx || 1e-9);
  const iy = 1 / (dy || 1e-9);
  const iz = 1 / (dz || 1e-9);
  for (const bx of boxes) {
    let t1 = (bx.minX - ox) * ix;
    let t2 = (bx.maxX - ox) * ix;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);
    t1 = (bx.minY - oy) * iy;
    t2 = (bx.maxY - oy) * iy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (bx.minZ - oz) * iz;
    t2 = (bx.maxZ - oz) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax >= Math.max(tmin, 0) && tmin < best && tmin <= maxDist) best = Math.max(tmin, 0);
  }
  return best;
}
