// Clothing painted onto the shared CC0 body with a shader, using each vertex's bind-pose position.
import * as THREE from "three";
import type { OutfitKey } from "../sim/world";

export type Outfit = {
  skinTint: string;
  /** 0 = bare, 1 = tank top, 2 = t-shirt, 3 = long sleeves. */
  shirtType: 0 | 1 | 2 | 3;
  shirt: string;
  plaid: string | null;
  pants: string;
  pantsFade: number;
  shoes: string;
  band: boolean;
  hair: string;
  /** Extra looseness of the trousers in metres. */
  baggy: number;
  /** Horizontal body scale (heavier build). */
  bulk: number;
  waist: number;
};

export const OUTFITS: Record<OutfitKey, Outfit> = {
  hero: {
    skinTint: "#7d5a45",
    shirtType: 1,
    shirt: "#ecebe6",
    plaid: null,
    pants: "#2f4c7a",
    pantsFade: 1,
    shoes: "#eeeeec",
    band: true,
    hair: "#151110",
    baggy: 0.024,
    bulk: 1,
    waist: 0.995,
  },
  big: {
    skinTint: "#6e4d3a",
    shirtType: 2,
    shirt: "#2e6b3c",
    plaid: null,
    pants: "#1f2024",
    pantsFade: 0.15,
    shoes: "#f0efea",
    band: false,
    hair: "#100c0b",
    baggy: 0.04,
    bulk: 1.22,
    waist: 1.02,
  },
  flannel: {
    skinTint: "#a07a60",
    shirtType: 3,
    shirt: "#3f6e45",
    plaid: "#16241a",
    pants: "#b3a07a",
    pantsFade: 0,
    shoes: "#ecebe7",
    band: false,
    hair: "#1a1411",
    baggy: 0.035,
    bulk: 1.02,
    waist: 1.0,
  },
  flannelDark: {
    skinTint: "#5e4231",
    shirtType: 3,
    shirt: "#2f3d33",
    plaid: "#7d9a6a",
    pants: "#2a3f63",
    pantsFade: 0.6,
    shoes: "#17181a",
    band: false,
    hair: "#0e0b0a",
    baggy: 0.03,
    bulk: 1.0,
    waist: 1.0,
  },
};

/** Region of a bind-pose point. Keep in sync with the GLSL in `makeOutfitMaterial`. */
export function regionOf(x: number, y: number, z: number, o: Outfit): "shoe" | "legs" | "belt" | "shirt" | "skin" {
  const ax = Math.abs(x);
  if (y < 0.12) return "shoe";
  if (y < o.waist) return "legs";
  if (y < o.waist + (o.band ? 0.065 : 0.035)) return "belt";
  if (o.shirtType === 0 || y > 1.56) return "skin";
  const isArm = ax > 0.2 && y > 1.36;
  const sleeve = o.shirtType === 1 ? 0 : o.shirtType === 2 ? 0.36 : 0.71;
  if (isArm) return ax < sleeve ? "shirt" : "skin";
  if (o.shirtType === 1) {
    if (y > 1.33 && ax > 0.135) return "skin";
    if (y > 1.52) return "skin";
    if (z > 0 && y > 1.38 && ax < 0.085) return "skin";
    if (z <= 0 && y > 1.46 && ax < 0.075) return "skin";
    return "shirt";
  }
  if (y > 1.5 && ax < 0.075) return "skin";
  if (y > 1.545) return "skin";
  return "shirt";
}

/** Clone of the body geometry with an `aBind` attribute and clothes pushed out along the normals. */
export function buildOutfitGeometry(mesh: THREE.SkinnedMesh, o: Outfit) {
  mesh.updateMatrixWorld(true);
  const src = mesh.geometry;
  const geo = src.clone();
  const pos = src.attributes["position"]!;
  const nor = src.attributes["normal"]!;
  const m = mesh.matrixWorld;
  const scale = m.getMaxScaleOnAxis();
  const outPos = new Float32Array(pos.count * 3);
  const bind = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i).normalize();
    w.copy(v).applyMatrix4(m);
    bind[i * 3] = w.x;
    bind[i * 3 + 1] = w.y;
    bind[i * 3 + 2] = w.z;
    const region = regionOf(w.x, w.y, w.z, o);
    let k = 0;
    if (region === "shoe") k = 0.012;
    else if (region === "legs") {
      const toWaist = THREE.MathUtils.smoothstep(w.y, o.waist - 0.12, o.waist);
      k = o.baggy * (1 - toWaist * 0.6) + Math.max(0, 0.45 - w.y) * 0.05;
    } else if (region === "belt") k = 0.01;
    else if (region === "shirt") k = o.shirtType === 1 ? 0.006 : o.shirtType === 2 ? 0.014 : 0.016;
    v.addScaledVector(n, k / scale);
    outPos[i * 3] = v.x;
    outPos[i * 3 + 1] = v.y;
    outPos[i * 3 + 2] = v.z;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(outPos, 3));
  geo.setAttribute("aBind", new THREE.BufferAttribute(bind, 3));
  geo.deleteAttribute("color");
  geo.computeBoundingSphere();
  return geo;
}

const col = (c: string) => new THREE.Color(c);

export function makeOutfitMaterial(base: THREE.MeshStandardMaterial, o: Outfit) {
  const mat = base.clone();
  mat.vertexColors = false;
  mat.metalness = 0;
  const uniforms = {
    uSkinTint: { value: col(o.skinTint) },
    uShirtType: { value: o.shirtType },
    uShirt: { value: col(o.shirt) },
    uPlaid: { value: col(o.plaid ?? o.shirt) },
    uHasPlaid: { value: o.plaid ? 1 : 0 },
    uPants: { value: col(o.pants) },
    uPantsFade: { value: o.pantsFade },
    uShoes: { value: col(o.shoes) },
    uBand: { value: o.band ? 1 : 0 },
    uWaist: { value: o.waist },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aBind;\nvarying vec3 vBind;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBind = aBind;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vBind;
uniform vec3 uSkinTint, uShirt, uPlaid, uPants, uShoes;
uniform float uShirtType, uHasPlaid, uPantsFade, uBand, uWaist;
float gCloth;
float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float region(vec3 bp) {
  // 0 skin, 1 shoe, 2 legs, 3 belt, 4 band, 5 shirt
  float ax = abs(bp.x);
  if (bp.y < 0.12) return 1.0;
  if (bp.y < uWaist) return 2.0;
  if (bp.y < uWaist + 0.035) return 3.0;
  if (uBand > 0.5 && bp.y < uWaist + 0.065) return 4.0;
  if (uShirtType < 0.5 || bp.y > 1.56) return 0.0;
  float sleeve = uShirtType < 1.5 ? 0.0 : (uShirtType < 2.5 ? 0.36 : 0.71);
  if (ax > 0.2 && bp.y > 1.36) return ax < sleeve ? 5.0 : 0.0;
  if (uShirtType < 1.5) {
    if (bp.y > 1.33 && ax > 0.135) return 0.0;
    if (bp.y > 1.52) return 0.0;
    if (bp.z > 0.0 && bp.y > 1.38 && ax < 0.085) return 0.0;
    if (bp.z <= 0.0 && bp.y > 1.46 && ax < 0.075) return 0.0;
    return 5.0;
  }
  if (bp.y > 1.5 && ax < 0.075) return 0.0;
  if (bp.y > 1.545) return 0.0;
  return 5.0;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
{
  vec3 bp = vBind;
  float r = region(bp);
  float n = hash3(floor(bp * 220.0));
  vec3 cloth = vec3(0.0);
  gCloth = 1.0;
  if (r < 0.5) {
    gCloth = 0.0;
  } else if (r < 1.5) {
    cloth = bp.y < 0.028 ? vec3(0.12) : uShoes;
    if (bp.y > 0.07 && abs(bp.x - sign(bp.x) * 0.114) < 0.02 && bp.z > 0.02) cloth *= 0.82;
  } else if (r < 2.5) {
    float tw = sin((bp.x * 0.6 + bp.y + bp.z * 0.6) * 950.0) * 0.5 + 0.5;
    vec3 c = uPants * (0.88 + 0.12 * tw);
    float fade = smoothstep(0.48, 0.85, bp.y) * smoothstep(-0.03, 0.09, bp.z);
    float knee = (1.0 - smoothstep(0.0, 0.09, abs(bp.y - 0.55))) * smoothstep(0.0, 0.08, bp.z);
    c = mix(c, c * 1.5 + 0.035, clamp(fade * 0.5 + knee * 0.35, 0.0, 1.0) * uPantsFade);
    if (bp.y < 0.24) c *= 0.84 + 0.16 * sin(bp.y * 150.0);
    float seam = 1.0 - smoothstep(0.003, 0.008, abs(abs(bp.z + 0.01) - 0.0) );
    c *= 1.0 - seam * 0.15 * step(0.16, abs(bp.x));
    cloth = c * (0.94 + 0.1 * n);
  } else if (r < 3.5) {
    cloth = vec3(0.16, 0.1, 0.065);
    if (abs(bp.x) < 0.03 && bp.z > 0.0) cloth = vec3(0.72, 0.7, 0.66);
  } else if (r < 4.5) {
    cloth = vec3(0.9, 0.9, 0.92);
    if (fract(bp.y * 140.0) > 0.7) cloth = vec3(0.25, 0.32, 0.55);
  } else {
    vec3 c = uShirt;
    if (uHasPlaid > 0.5) {
      float gx = step(0.62, fract(bp.x * 10.0 + 0.3));
      float gy = step(0.62, fract(bp.y * 10.0));
      c = mix(uShirt, uPlaid, max(gx, gy) * 0.7);
      c = mix(c, uPlaid * 0.7, gx * gy * 0.6);
      float fine = step(0.95, fract(bp.x * 10.0 + 0.75)) + step(0.95, fract(bp.y * 10.0 + 0.45));
      c = mix(c, vec3(0.85, 0.8, 0.7), clamp(fine, 0.0, 1.0) * 0.35);
    } else if (uShirtType < 1.5) {
      c *= 0.93 + 0.07 * sin(bp.x * 420.0 + bp.z * 60.0);
    }
    cloth = c * (0.95 + 0.08 * n);
  }
  diffuseColor.rgb = gCloth > 0.5 ? cloth : diffuseColor.rgb * uSkinTint * 1.15;
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, gCloth);",
      );
  };
  mat.customProgramCacheKey = () => "outfit-v1";
  return mat;
}
