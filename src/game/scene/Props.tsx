import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { BOUNDS, type ModelKey, type Placement, type World } from "../sim/world";
import { MODEL_URLS } from "./assets";
import { buildBatch } from "./batch";
import { poleWoodTexture, stuccoTexture } from "./textures";

const KEYS = Object.keys(MODEL_URLS) as ModelKey[];
const SKY: ModelKey[] = ["skyA", "skyB", "skyD", "skyE"];
export const HAZE = "#e7b88d";

export function Props({ world, homeId }: { world: World; homeId: string }) {
  const gltfs = useGLTF(KEYS.map((k) => MODEL_URLS[k]));
  const group = useMemo(() => {
    const scenes = {} as Record<ModelKey, THREE.Object3D>;
    KEYS.forEach((k, i) => (scenes[k] = gltfs[i].scene));
    const near: Placement[] = world.placements.filter((p) => !SKY.includes(p.model));
    const far: Placement[] = world.placements.filter((p) => SKY.includes(p.model));
    const g = new THREE.Group();
    g.add(
      buildBatch(scenes, near, {
        cuts: {
          // Remove the baked-in front door of the home so the animated door can open.
          [homeId]: { minX: -0.255, maxX: 0.255, minY: -0.02, maxY: 0.935, minZ: 0.94, maxZ: 0.99, materials: ["Wood", "DarkWood"] },
        },
      }),
    );
    g.add(buildBatch(scenes, far, { haze: { color: HAZE, amount: 0.55 } }));
    return g;
  }, [gltfs, world, homeId]);
  return <primitive object={group} />;
}

export function Poles({ world }: { world: World }) {
  const { poleGeo, armGeo, wireGeo, mats } = useMemo(() => {
    const wood = poleWoodTexture();
    const poleParts: THREE.BufferGeometry[] = [];
    const armParts: THREE.BufferGeometry[] = [];
    for (const p of world.poles) {
      const g = new THREE.CylinderGeometry(0.11, 0.15, p.height, 8);
      g.translate(p.x, p.height / 2, p.z);
      poleParts.push(g);
      const along = p.z > 5 ? "x" : "z";
      const arm = new THREE.BoxGeometry(along === "z" ? 1.8 : 0.12, 0.12, along === "z" ? 0.12 : 1.8);
      arm.translate(p.x, p.height - 0.6, p.z);
      armParts.push(arm);
    }
    // Sagging wires between consecutive poles of each line.
    const wires: THREE.BufferGeometry[] = [];
    const lines = [world.poles.filter((p) => p.z > 5), world.poles.filter((p) => p.z <= 5)];
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const bb = line[i + 1];
        const along = line === lines[0] ? "x" : "z";
        for (const off of [-0.75, 0, 0.75]) {
          const pts: THREE.Vector3[] = [];
          for (let k = 0; k <= 16; k++) {
            const t = k / 16;
            const ox = along === "z" ? off : 0;
            const oz = along === "x" ? off : 0;
            const sag = Math.sin(t * Math.PI) * 0.9;
            pts.push(
              new THREE.Vector3(a.x + (bb.x - a.x) * t + ox, a.height - 0.5 - sag, a.z + (bb.z - a.z) * t + oz),
            );
          }
          wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 3, false));
        }
      }
    }
    const merge = (parts: THREE.BufferGeometry[]) => {
      const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p));
      nonIndexed.forEach((p) => {
        for (const k of Object.keys(p.attributes)) if (!["position", "normal", "uv"].includes(k)) p.deleteAttribute(k);
      });
      return nonIndexed.length ? mergeAll(nonIndexed) : new THREE.BufferGeometry();
    };
    return {
      poleGeo: merge(poleParts),
      armGeo: merge(armParts),
      wireGeo: merge(wires),
      mats: {
        wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.95 }),
        wire: new THREE.MeshStandardMaterial({ color: "#1b1a19", roughness: 0.8 }),
      },
    };
  }, [world]);
  return (
    <group>
      <mesh geometry={poleGeo} material={mats.wood} castShadow receiveShadow />
      <mesh geometry={armGeo} material={mats.wood} castShadow />
      <mesh geometry={wireGeo} material={mats.wire} />
    </group>
  );
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    if (p.attributes.normal) nor.set(p.attributes.normal.array as Float32Array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array as Float32Array, o * 2);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

export function BoundaryWalls({ world }: { world: World }) {
  const { geo, cap, mat, capMat } = useMemo(() => {
    const tex = stuccoTexture("#cdb08a");
    const parts: THREE.BufferGeometry[] = [];
    const caps: THREE.BufferGeometry[] = [];
    for (const w of world.walls) {
      const sx = w.maxX - w.minX;
      const sz = w.maxZ - w.minZ;
      const h = w.maxY - w.minY;
      const g = new THREE.BoxGeometry(sx, h, sz);
      // World-scaled UVs so the stucco does not stretch.
      const uv = g.attributes.uv;
      const n = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        const horiz = Math.abs(n.getX(i)) > 0.5 ? sz : sx;
        uv.setXY(i, (uv.getX(i) * horiz) / 4, (uv.getY(i) * h) / 4);
      }
      g.translate((w.minX + w.maxX) / 2, (w.minY + w.maxY) / 2, (w.minZ + w.maxZ) / 2);
      parts.push(g.toNonIndexed());
      if (h > 1) {
        const c = new THREE.BoxGeometry(sx + 0.12, 0.14, sz + 0.12);
        c.translate((w.minX + w.maxX) / 2, w.maxY + 0.07, (w.minZ + w.maxZ) / 2);
        caps.push(c.toNonIndexed());
      }
    }
    return {
      geo: mergeAll(parts),
      cap: mergeAll(caps),
      mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
      capMat: new THREE.MeshStandardMaterial({ color: "#a89880", roughness: 0.9 }),
    };
  }, [world]);
  void BOUNDS;
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      <mesh geometry={cap} material={capMat} castShadow receiveShadow />
    </group>
  );
}
