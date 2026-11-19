import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { CIRCLE, GROUND_Y, POOL, POOL_DECK, poolFloor, type Rect } from "../sim/world";
import { TEXTURE_URLS } from "./assets";
import { poolTileTexture } from "./textures";

/** Road outline (world XZ), offset outward by `o` metres: avenue + cul-de-sac street + turning circle. */
function roadOutline(o: number): [number, number][] {
  const half = 5 + o;
  const r = CIRCLE.r + o;
  const pts: [number, number][] = [];
  const far = 160;
  const zJoin = CIRCLE.z + Math.sqrt(r * r - half * half);
  pts.push([-far, -half], [-half, -half], [-half, zJoin]);
  const a0 = Math.atan2(zJoin - CIRCLE.z, -half);
  const a1 = Math.atan2(zJoin - CIRCLE.z, half) + Math.PI * 2;
  const steps = 56;
  for (let i = 1; i < steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([CIRCLE.x + Math.cos(a) * r, CIRCLE.z + Math.sin(a) * r]);
  }
  pts.push([half, zJoin], [half, -half], [far, -half], [far, half], [-far, half]);
  return pts;
}

const toPath = (pts: [number, number][], path: THREE.Path) => {
  pts.forEach(([x, z], i) => (i === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z)));
  path.closePath();
  return path;
};

const rectPts = (r: Rect): [number, number][] => [
  [r.minX, r.minZ],
  [r.maxX, r.minZ],
  [r.maxX, r.maxZ],
  [r.minX, r.maxZ],
];

function flatShape(outer: [number, number][], holes: [number, number][][], y: number) {
  const shape = toPath(outer, new THREE.Shape()) as THREE.Shape;
  for (const h of holes) shape.holes.push(toPath(h, new THREE.Path()));
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // World-space UVs (metres).
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i);
    uv[i * 2 + 1] = pos.getZ(i);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Vertical strip along a closed outline (curb faces). */
function curbGeometry(pts: [number, number][], y0: number, y1: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(bx - ax, bz - az);
    pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
    uv.push(run, 0, run + len, 0, run + len, 0.12, run, 0, run + len, 0.12, run, 0.12);
    run += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function markingsGeometry() {
  const quads: [number, number, number, number][] = [];
  const quad = (x0: number, z0: number, x1: number, z1: number) => quads.push([x0, z0, x1, z1]);
  // Double yellow line on the avenue (broken at the junction).
  for (const [a, b] of [
    [-160, -5.5],
    [5.5, 160],
  ]) {
    quad(a, -0.22, b, -0.12);
    quad(a, 0.12, b, 0.22);
  }
  // Centre dashes up the cul-de-sac.
  for (let z = -8; z > CIRCLE.z + 11; z -= 4.5) quad(-0.06, z - 2.2, 0.06, z);
  // Zebra crossing at the mouth of the cul-de-sac.
  for (let x = -4.4; x < 4.4; x += 1.1) quad(x, -9.2, x + 0.55, -6.6);
  // Stop line.
  quad(-4.8, -10.2, 0, -9.8);
  const pos: number[] = [];
  for (const [x0, z0, x1, z1] of quads) pos.push(x0, 0, z0, x1, 0, z1, x1, 0, z0, x0, 0, z0, x0, 0, z1, x1, 0, z1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.translate(0, 0.012, 0);
  return g;
}

function poolGeometry() {
  // Inner walls (facing inwards) and stepped floor.
  const parts: THREE.BufferGeometry[] = [];
  const top = GROUND_Y;
  const wall = (x0: number, z0: number, x1: number, z1: number, y0: number) => {
    const g = new THREE.PlaneGeometry(Math.hypot(x1 - x0, z1 - z0), top - y0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
    g.translate(mx, (top + y0) / 2, mz);
    parts.push(g);
  };
  const { minX, maxX, minZ, maxZ } = POOL;
  // Normal of a wall from (x0,z0) to (x1,z1) is (-dz, dx): every wall faces into the pool.
  wall(minX, minZ, maxX, minZ, POOL.floor);
  wall(maxX, maxZ, minX, maxZ, POOL.floor);
  wall(minX, maxZ, minX, minZ, POOL.floor);
  wall(maxX, minZ, maxX, maxZ, POOL.floor);
  // Floor segments + step risers.
  const xs = [minX, minX + 0.6, minX + 1.2, minX + 1.8, maxX];
  for (let i = 0; i < xs.length - 1; i++) {
    const y = poolFloor((xs[i]! + xs[i + 1]!) / 2);
    const g = new THREE.PlaneGeometry(xs[i + 1]! - xs[i]!, maxZ - minZ);
    g.rotateX(-Math.PI / 2);
    g.translate((xs[i]! + xs[i + 1]!) / 2, y, (minZ + maxZ) / 2);
    parts.push(g);
    if (i < xs.length - 2) {
      const yNext = poolFloor((xs[i + 1]! + xs[i + 2]!) / 2);
      const riser = new THREE.PlaneGeometry(maxZ - minZ, y - yNext);
      riser.rotateY(Math.PI / 2);
      riser.translate(xs[i + 1]!, (y + yNext) / 2, (minZ + maxZ) / 2);
      parts.push(riser);
    }
  }
  return parts;
}

export function Ground() {
  const tex = useTexture(TEXTURE_URLS);
  const mats = useMemo(() => {
    const setup = (t: THREE.Texture, repeat: number, srgb: boolean) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
    };
    const asphaltMap = tex.asphaltColor.clone();
    setup(asphaltMap, 1 / 7, true);
    const asphaltNormal = tex.asphaltNormal.clone();
    setup(asphaltNormal, 1 / 7, false);
    const walk = tex.sidewalkColor.clone();
    setup(walk, 1 / 2.6, true);
    const walkN = tex.sidewalkNormal.clone();
    setup(walkN, 1 / 2.6, false);
    const grass = tex.grassColor.clone();
    setup(grass, 1 / 4.5, true);
    const grassN = tex.grassNormal.clone();
    setup(grassN, 1 / 4.5, false);
    const tiles = poolTileTexture();
    tiles.repeat.set(1, 1);
    return {
      asphalt: new THREE.MeshStandardMaterial({ map: asphaltMap, normalMap: asphaltNormal, roughness: 0.95, color: "#b9b1a6" }),
      sidewalk: new THREE.MeshStandardMaterial({ map: walk, normalMap: walkN, roughness: 0.9, color: "#e4d9c6" }),
      curb: new THREE.MeshStandardMaterial({ map: walk, roughness: 0.9, color: "#d8cdb9" }),
      grass: new THREE.MeshStandardMaterial({ map: grass, normalMap: grassN, roughness: 1, color: "#d7cf95" }),
      lines: new THREE.MeshStandardMaterial({ color: "#e8c35a", roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }),
      tiles: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4, color: "#ffffff" }),
    };
  }, [tex]);

  const geos = useMemo(() => {
    const road = roadOutline(0);
    const walk = roadOutline(2.6);
    const lawnOuter: [number, number][] = [
      [-170, -170],
      [170, -170],
      [170, 110],
      [-170, 110],
    ];
    return {
      road: flatShape(road, [], 0),
      sidewalk: flatShape(walk, [road], GROUND_Y),
      curb: curbGeometry(road, 0, GROUND_Y),
      lawn: flatShape(lawnOuter, [walk, rectPts(POOL_DECK)], GROUND_Y),
      deck: flatShape(rectPts(POOL_DECK), [rectPts(POOL)], GROUND_Y + 0.004),
      lines: markingsGeometry(),
      pool: poolGeometry(),
    };
  }, []);

  return (
    <group>
      <mesh geometry={geos.road} material={mats.asphalt} receiveShadow />
      <mesh geometry={geos.sidewalk} material={mats.sidewalk} receiveShadow />
      <mesh geometry={geos.curb} material={mats.curb} receiveShadow />
      <mesh geometry={geos.lawn} material={mats.grass} receiveShadow />
      <mesh geometry={geos.deck} material={mats.sidewalk} receiveShadow />
      <mesh geometry={geos.lines} material={mats.lines} receiveShadow />
      {geos.pool.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.tiles} receiveShadow />
      ))}
    </group>
  );
}
