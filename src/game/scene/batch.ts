// Static batching: merges every placed copy of every prop into one mesh per material and tint.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ModelKey, Placement } from "../sim/world";

type Cut = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; materials: string[] };

/** Plain float geometry (position, normal, uv) transformed into world space; optional triangles removed. */
function bake(src: THREE.BufferGeometry, matrix: THREE.Matrix4, local: THREE.Matrix4, cut?: Cut) {
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const uv = src.attributes.uv;
  const n = pos.count;
  const p = new Float32Array(n * 3);
  const nn = new Float32Array(n * 3);
  const u = new Float32Array(n * 2);
  const v = new THREE.Vector3();
  const lv = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    if (cut) {
      lv.copy(v).applyMatrix4(local);
      inside[i] =
        lv.x > cut.minX && lv.x < cut.maxX && lv.y > cut.minY && lv.y < cut.maxY && lv.z > cut.minZ && lv.z < cut.maxZ ? 1 : 0;
    }
    v.applyMatrix4(matrix);
    p.set([v.x, v.y, v.z], i * 3);
    if (nor) {
      v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      nn.set([v.x, v.y, v.z], i * 3);
    }
    if (uv) u.set([uv.getX(i), uv.getY(i)], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(u, 2));
  let index: number[] = src.index ? Array.from(src.index.array as ArrayLike<number>) : [...Array(n).keys()];
  if (cut) {
    const kept: number[] = [];
    for (let i = 0; i < index.length; i += 3) {
      if (inside[index[i]] && inside[index[i + 1]] && inside[index[i + 2]]) continue;
      kept.push(index[i], index[i + 1], index[i + 2]);
    }
    index = kept;
  }
  g.setIndex(index);
  if (!nor) g.computeVertexNormals();
  return g;
}

export type BatchOptions = {
  cuts?: Record<string, Cut>;
  /** Mix every material toward this colour and disable fog (distant skyline). */
  haze?: { color: string; amount: number };
};

export function buildBatch(
  scenes: Record<ModelKey, THREE.Object3D>,
  placements: Placement[],
  opts: BatchOptions = {},
): THREE.Group {
  const groups = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const placementMatrix = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const toLocal = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (const pl of placements) {
    const scene = scenes[pl.model];
    scene.updateMatrixWorld(true);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.rot);
    placementMatrix.compose(new THREE.Vector3(pl.x, pl.y, pl.z), q, new THREE.Vector3(...pl.scale));
    const cut = opts.cuts?.[pl.id];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      world.multiplyMatrices(placementMatrix, mesh.matrixWorld);
      toLocal.copy(mesh.matrixWorld);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const geoGroups = mesh.geometry.groups.length
        ? mesh.geometry.groups
        : [{ start: 0, count: mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count, materialIndex: 0 }];
      for (const gg of geoGroups) {
        const base = mats[gg.materialIndex ?? 0] as THREE.MeshStandardMaterial;
        const tint = pl.tint?.[base.name];
        const key = `${pl.model}|${base.name}|${tint ?? ""}`;
        let entry = groups.get(key);
        if (!entry) {
          const m = base.clone();
          m.vertexColors = false;
          if (tint) m.color.set(tint);
          if (opts.haze) {
            m.color.lerp(new THREE.Color(opts.haze.color), opts.haze.amount);
            m.emissive = new THREE.Color(opts.haze.color).multiplyScalar(opts.haze.amount * 0.55);
            m.fog = false;
          }
          entry = { material: m, geos: [] };
          groups.set(key, entry);
        }
        let src = mesh.geometry;
        if (mesh.geometry.groups.length > 1) {
          src = mesh.geometry.clone();
          const idx = mesh.geometry.index!;
          src.setIndex(Array.from(idx.array as ArrayLike<number>).slice(gg.start, gg.start + gg.count));
        }
        const useCut = cut && cut.materials.includes(base.name) ? cut : undefined;
        entry.geos.push(bake(src, world, toLocal, useCut));
      }
    });
  }
  const out = new THREE.Group();
  for (const { material, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = !opts.haze;
    mesh.receiveShadow = !opts.haze;
    out.add(mesh);
  }
  return out;
}
