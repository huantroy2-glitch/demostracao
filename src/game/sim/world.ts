// World layout and spatial queries. Pure data + functions: no React, no three.js.
import { mulberry32 } from "./math";

export type Box = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type ModelKey =
  | "house1"
  | "house2gable"
  | "house2side"
  | "house2stairs"
  | "carSedan"
  | "carSedan2"
  | "carCoupe"
  | "palm1"
  | "palm3"
  | "palm4"
  | "streetLight"
  | "hydrant"
  | "bench"
  | "trashBin"
  | "dumpster"
  | "skyA"
  | "skyB"
  | "skyD"
  | "skyE";

type Vec3 = [number, number, number];

type CatalogEntry = { scale: Vec3; boxes: Box[] };

const b = (minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number): Box => ({
  minX,
  maxX,
  minY,
  maxY,
  minZ,
  maxZ,
});

/** Collision boxes in model units (before scale), measured from the GLB files. Front of houses is +Z, cars face -Z. */
export const CATALOG: Record<ModelKey, CatalogEntry> = {
  house1: { scale: [3, 2.7, 3], boxes: [b(-1.0, 1.0, -0.98, 0.98, 0, 2.0)] },
  house2gable: { scale: [3, 2.7, 3], boxes: [b(-1.04, 1.04, -0.98, 0.98, 0, 3.1)] },
  house2side: { scale: [3, 2.7, 3], boxes: [b(-1.68, 1.42, -1.0, 0.82, 0, 2.75)] },
  house2stairs: {
    scale: [3, 2.7, 3],
    boxes: [b(-1.05, 1.05, -1.0, 0.82, 0, 2.75), b(-0.34, 0.34, 0.82, 0.97, 0, 0.15)],
  },
  carSedan: { scale: [1, 1, 1], boxes: [b(-0.88, 0.88, -2.08, 2.08, 0, 1.1)] },
  carSedan2: { scale: [1, 1, 1], boxes: [b(-0.8, 0.8, -1.62, 1.62, 0, 1.08)] },
  carCoupe: { scale: [1, 1, 1], boxes: [b(-0.88, 0.88, -1.95, 1.95, 0, 1.05)] },
  palm1: { scale: [2.6, 2.6, 2.6], boxes: [b(-0.33, -0.09, -0.39, -0.13, 0, 3)] },
  palm3: { scale: [2.8, 2.8, 2.8], boxes: [b(-0.33, -0.09, -0.26, 0, 0, 3)] },
  palm4: { scale: [2.9, 2.9, 2.9], boxes: [b(-0.18, -0.02, -0.16, 0.02, 0, 3)] },
  streetLight: { scale: [1, 1, 1], boxes: [b(-0.15, 0.15, -1.44, -1.14, 0, 6.5)] },
  hydrant: { scale: [1, 1, 1], boxes: [b(-0.18, 0.18, -0.15, 0.15, 0, 0.77)] },
  bench: { scale: [1, 1, 1], boxes: [b(-0.56, 0.56, -0.32, 0.25, 0, 0.5)] },
  trashBin: { scale: [1, 1, 1], boxes: [b(-0.3, 0.3, -0.38, 0.38, 0, 1.09)] },
  dumpster: { scale: [0.75, 0.75, 0.75], boxes: [b(-1.22, 1.22, -0.65, 0.65, 0, 2.03)] },
  skyA: { scale: [24, 24, 24], boxes: [] },
  skyB: { scale: [24, 24, 24], boxes: [] },
  skyD: { scale: [24, 24, 24], boxes: [] },
  skyE: { scale: [24, 24, 24], boxes: [] },
};

export type Placement = {
  id: string;
  model: ModelKey;
  x: number;
  y: number;
  z: number;
  /** Rotation around Y, always a multiple of PI/2 so colliders stay axis-aligned. */
  rot: number;
  scale: Vec3;
  /** Material name -> CSS colour overrides. */
  tint?: Record<string, string>;
};

export type Pole = { id: string; x: number; z: number; height: number };

export type Interactable =
  | { id: string; kind: "door"; x: number; z: number; facing: number; label: string }
  | { id: string; kind: "bench"; x: number; z: number; facing: number; label: string; seatY: number }
  | { id: string; kind: "npc"; x: number; z: number; facing: number; label: string; npcId: string }
  | { id: string; kind: "pickup"; x: number; z: number; y: number; facing: number; label: string; value: number };

export type NpcDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  facing: number;
  outfit: OutfitKey;
  idle: "idle" | "talk" | "dance";
  lines: string[];
};

export type OutfitKey = "hero" | "big" | "flannel" | "flannelDark";

export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export type Pool = Rect & { surface: number; floor: number };

/** Ground level of lawns and sidewalks. Roads sit at y = 0, so every curb is a small step. */
export const GROUND_Y = 0.12;

export const ROADS: Rect[] = [
  { minX: -70, maxX: 70, minZ: -5, maxZ: 5 },
  { minX: -5, maxX: 5, minZ: -64, maxZ: -5 },
];
export const CIRCLE = { x: 0, z: -64, r: 13 };

export const POOL: Pool = { minX: 36, maxX: 48, minZ: -36, maxZ: -28, surface: 0.0, floor: -1.7 };
export const POOL_DECK: Rect = { minX: 33, maxX: 51, minZ: -39.5, maxZ: -24.5 };

export const BOUNDS: Rect = { minX: -60, maxX: 60, minZ: -100, maxZ: 28 };

export const SPAWN = { x: 0, z: -58, facing: Math.PI };

const inRect = (r: Rect, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

export function isRoad(x: number, z: number) {
  if (ROADS.some((r) => inRect(r, x, z))) return true;
  const dx = x - CIRCLE.x;
  const dz = z - CIRCLE.z;
  return dx * dx + dz * dz <= CIRCLE.r * CIRCLE.r;
}

export function inPool(x: number, z: number) {
  return inRect(POOL, x, z);
}

/** Height of the pool floor: three steps at the west (shallow) end, then the deep basin. */
export function poolFloor(x: number) {
  const d = x - POOL.minX;
  if (d < 0.6) return -0.35;
  if (d < 1.2) return -0.7;
  if (d < 1.8) return -1.05;
  return POOL.floor;
}

/** Static terrain height (roads, curbs, lawns, pool). Boxes are queried separately. */
export function terrainHeight(x: number, z: number) {
  if (inPool(x, z)) return poolFloor(x);
  if (isRoad(x, z)) return 0;
  return GROUND_Y;
}

export function waterSurfaceAt(x: number, z: number): number | null {
  return inPool(x, z) ? POOL.surface : null;
}

/** Rotate a local (x, z) offset by a Y rotation, matching three.js Object3D.rotation.y. */
export function rotateXZ(x: number, z: number, rot: number): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x * c + z * s, -x * s + z * c];
}

export function placementBoxes(p: Placement): Box[] {
  const [sx, sy, sz] = p.scale;
  return CATALOG[p.model].boxes.map((lb) => {
    const corners = [
      rotateXZ(lb.minX * sx, lb.minZ * sz, p.rot),
      rotateXZ(lb.maxX * sx, lb.minZ * sz, p.rot),
      rotateXZ(lb.minX * sx, lb.maxZ * sz, p.rot),
      rotateXZ(lb.maxX * sx, lb.maxZ * sz, p.rot),
    ];
    const xs = corners.map((c) => c[0] + p.x);
    const zs = corners.map((c) => c[1] + p.z);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      minY: p.y + lb.minY * sy,
      maxY: p.y + lb.maxY * sy,
    };
  });
}

export type World = {
  placements: Placement[];
  poles: Pole[];
  walls: Box[];
  boxes: Box[];
  interactables: Interactable[];
  npcs: NpcDef[];
  homeDoor: { x: number; y: number; z: number; width: number; height: number };
};

const HALF_PI = Math.PI / 2;

export const NPC_RADIUS = 0.35;

export function buildWorld(): World {
  const placements: Placement[] = [];
  let n = 0;
  const place = (model: ModelKey, x: number, z: number, rot: number, tint?: Record<string, string>, y = 0) => {
    const p: Placement = { id: `${model}-${n++}`, model, x, y, z, rot, scale: CATALOG[model].scale, tint };
    placements.push(p);
    return p;
  };

  // Stucco palette pulled from the reference shots: peach, sand, faded mint, cream, terracotta.
  const walls = ["#c98f6a", "#d8b98c", "#9fb59a", "#e3d3b0", "#b5745a", "#c9a27a", "#a8a089"];
  const roofs = ["#5a3a2c", "#4a4038", "#6b4a35", "#3f3a36", "#704030"];
  let wi = 0;
  const houseTint = () => {
    const w = walls[wi % walls.length]!;
    const r = roofs[wi % roofs.length]!;
    wi++;
    return { Main: w, Bricks: w, Light: "#efe4cc", RoofBricks: r, White: "#e9e1cf", Dark: "#3b3330" };
  };

  // Cul-de-sac (the home street).
  place("house2gable", -14, -16, HALF_PI, houseTint());
  place("house1", -14, -30, HALF_PI, houseTint());
  place("house2stairs", -14, -44, HALF_PI, houseTint());
  place("house2stairs", 14, -16, -HALF_PI, houseTint());
  place("house2gable", 14, -30, -HALF_PI, houseTint());
  place("house1", 14, -44, -HALF_PI, houseTint());
  const home = place("house1", 0, -86, 0, {
    Main: "#7f9a6e",
    Bricks: "#8ba57a",
    Light: "#efe4cc",
    RoofBricks: "#4c3a2e",
    White: "#efe7d4",
    Dark: "#2f2a26",
  });
  place("house2gable", -19, -74, HALF_PI, houseTint());
  place("house2side", 19, -74, -HALF_PI, houseTint());
  place("house2gable", -14, -58, HALF_PI, houseTint());
  place("house2gable", 14, -58, -HALF_PI, houseTint());

  // Avenue, south side (fronts face the road, -Z).
  place("house2gable", -48, 14, Math.PI, houseTint());
  place("house2side", -28, 13.6, Math.PI, { ...houseTint(), Main: "#c6b49a", Bricks: "#b39f84" });
  place("house1", -10, 14, Math.PI, houseTint());
  place("house2stairs", 10, 13.6, Math.PI, houseTint());
  place("house1", 28, 14, Math.PI, houseTint());
  place("house2gable", 46, 14, Math.PI, houseTint());
  // Avenue, north side.
  place("house2stairs", -30, -13.6, 0, houseTint());
  place("house1", -46, -14, 0, houseTint());

  // Parked cars: muscle-era colours (Greenwood green, burgundy, tan, white, black).
  const carColours = ["#1f4a2a", "#5a1a1e", "#c9b48a", "#d9d6cf", "#18191c", "#6b2f1a", "#2c3e5a"];
  let ci = 0;
  const car = (model: "carSedan" | "carSedan2" | "carCoupe", x: number, z: number, rot: number) => {
    const c = carColours[ci++ % carColours.length]!;
    const bodyMats: Record<string, string[]> = {
      carSedan: ["Blue"],
      carSedan2: ["LightBlue"],
      carCoupe: ["Orange", "DarkOrange"],
    };
    const tint: Record<string, string> = {};
    for (const m of bodyMats[model]!) tint[m] = c;
    return place(model, x, z, rot, tint);
  };
  car("carSedan", -38, -3.5, HALF_PI);
  car("carCoupe", -18, -3.5, HALF_PI);
  car("carSedan2", 22, -3.5, HALF_PI);
  car("carSedan", 40, 3.5, -HALF_PI);
  car("carSedan2", -2 - 20, 3.5, -HALF_PI);
  car("carCoupe", 3.4, -24, 0);
  car("carSedan", -3.4, -40, Math.PI);
  car("carSedan2", 3.4, -50, 0);
  const homeCar = car("carCoupe", 6.5, -80, 0.0);
  void homeCar;

  // Street lights: post on the sidewalk, lamp head over the road.
  for (let x = -60; x <= 60; x += 24) {
    place("streetLight", x, -6.4 + 1.29, 0);
    place("streetLight", x + 12, 6.4 - 1.29, Math.PI);
  }
  for (const z of [-20, -44]) {
    place("streetLight", -6.4 + 1.29, z, HALF_PI);
    place("streetLight", 6.4 - 1.29, z - 12, -HALF_PI);
  }

  // Props.
  place("hydrant", -6.3, -10, 0);
  place("hydrant", 18, 6.3, 0);
  place("hydrant", 6.3, -66, 0);
  place("trashBin", -9.5, -21, 0);
  place("trashBin", -9.5, -36, 0);
  place("trashBin", 9.5, -50, 0);
  place("trashBin", 3.2, -82.5, 0);
  place("dumpster", -38.5, 20, HALF_PI);

  // Park with the public pool (east of the cul-de-sac).
  place("bench", 42, -40.6, 0);
  place("bench", 42, -23.4, Math.PI);
  place("bench", 31.5, -32, HALF_PI);
  place("bench", -24, 7.6, Math.PI);
  place("bench", -32, 7.6, Math.PI);

  // Distant downtown skyline (no collision; seen through the haze).
  place("skyA", -70, -260, 0);
  place("skyB", -20, -300, HALF_PI);
  place("skyD", 30, -280, 0);
  place("skyE", 85, -250, Math.PI);
  place("skyB", 140, -320, 0);
  place("skyA", -130, -310, HALF_PI);

  // Palms: hand-placed rows plus seeded scatter that avoids roads, houses and the pool.
  const palmModels: ModelKey[] = ["palm1", "palm3", "palm4"];
  const rng = mulberry32(1992);
  const rowPalms: [number, number][] = [];
  for (let x = -54; x <= 54; x += 13) rowPalms.push([x + 4, -8.6], [x - 2, 8.6]);
  for (let z = -14; z >= -52; z -= 13) rowPalms.push([-8.8, z - 3], [8.8, z + 2]);
  rowPalms.push([-10, -78], [10, -80], [-6, -92], [8, -94], [30, -52], [54, -44], [52, -16], [28, -18], [56, -60]);
  rowPalms.push([-55, -30], [-40, -40], [-52, -60], [-30, -70], [-45, -88], [30, -92], [50, -84], [-56, 22], [56, 22]);
  const occupied = () => placements.flatMap(placementBoxes);
  for (const [x, z] of rowPalms) {
    const free = occupied().every(
      (bx) => x < bx.minX - 1.2 || x > bx.maxX + 1.2 || z < bx.minZ - 1.2 || z > bx.maxZ + 1.2,
    );
    if (!free || isRoad(x, z) || inRect(POOL_DECK, x, z)) continue;
    place(palmModels[Math.floor(rng() * palmModels.length)]!, x, z, Math.floor(rng() * 4) * HALF_PI);
  }

  // Telephone poles with sagging wires along the avenue and the cul-de-sac.
  const poles: Pole[] = [];
  for (let x = -56; x <= 56; x += 22) poles.push({ id: `pole-a${x}`, x, z: 9.2, height: 8.5 });
  for (let z = -12; z >= -78; z -= 22) poles.push({ id: `pole-c${z}`, x: -9.6, z, height: 8.5 });

  // Boundary: block walls around the playable area.
  const wallH = 3.2;
  const walls: Box[] = [
    b(BOUNDS.minX - 1, BOUNDS.maxX + 1, BOUNDS.minZ - 1, BOUNDS.minZ, 0, wallH),
    b(BOUNDS.minX - 1, BOUNDS.maxX + 1, BOUNDS.maxZ, BOUNDS.maxZ + 1, 0, wallH),
    b(BOUNDS.minX - 1, BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxZ, 0, wallH),
    b(BOUNDS.maxX, BOUNDS.maxX + 1, BOUNDS.minZ, BOUNDS.maxZ, 0, wallH),
  ];
  // Low garden walls: a 0.36 m step the player walks straight onto.
  walls.push(b(-11.6, -11.2, -26, -20, 0, 0.36));
  walls.push(b(11.2, 11.6, -40, -34, 0, 0.36));
  walls.push(b(-4.5, -1.2, -82.4, -82.0, 0, 0.36));

  const npcs: NpcDef[] = [
    {
      id: "big",
      name: "Grandalhão",
      x: 3.6,
      z: -76.5,
      facing: Math.PI * 0.85,
      outfit: "big",
      idle: "idle",
      lines: [
        "Olha quem voltou ao bairro! Pensava que te tinhas esquecido de nós.",
        "As coisas mudaram por aqui, mano. Há dinheiro espalhado pela rua toda.",
        "Apanha uns pacotes e depois vamos comer qualquer coisa. Eu pago... se tu pagares.",
      ],
    },
    {
      id: "rico",
      name: "Rico",
      x: -7.8,
      z: -66.5,
      facing: HALF_PI + 0.4,
      outfit: "flannel",
      idle: "talk",
      lines: [
        "Ei! Calma aí. Isto aqui é a nossa esquina.",
        "Vês aquela piscina no parque? Ninguém lá vai desde o verão passado.",
        "Se saltares para cima dos carros, às vezes encontras coisas no tejadilho.",
      ],
    },
    {
      id: "tito",
      name: "Tito",
      x: -6.4,
      z: -64.6,
      facing: -HALF_PI - 0.2,
      outfit: "flannelDark",
      idle: "dance",
      lines: ["Hoje o pôr do sol está bonito, não está?", "Este bairro tem alma. Não há outro igual."],
    },
  ];

  // Home door, in model units scaled by the house scale.
  const [hsx, hsy, hsz] = CATALOG.house1.scale;
  const homeDoor = { x: home.x, y: 0, z: home.z + 0.965 * hsz, width: 0.5 * hsx, height: 0.92 * hsy };

  const interactables: Interactable[] = [
    {
      id: "home-door",
      kind: "door",
      x: homeDoor.x,
      z: homeDoor.z + 0.75,
      facing: Math.PI,
      label: "abrir a porta",
    },
  ];
  for (const p of placements.filter((pp) => pp.model === "bench")) {
    const [fx, fz] = rotateXZ(0, 0.55, p.rot);
    interactables.push({
      id: `sit-${p.id}`,
      kind: "bench",
      x: p.x + fx,
      z: p.z + fz,
      facing: p.rot,
      label: "sentar no banco",
      seatY: GROUND_Y + 0.43,
    });
  }
  for (const npc of npcs) {
    interactables.push({ id: `talk-${npc.id}`, kind: "npc", x: npc.x, z: npc.z, facing: npc.facing, label: `falar com ${npc.name}`, npcId: npc.id });
  }

  const pickupSpots: [number, number, number, number][] = [
    [-30, 22.5, GROUND_Y, 150],
    [44, -50, GROUND_Y, 100],
    [-50, -40, GROUND_Y, 100],
    [0, -95, GROUND_Y, 200],
    [-38, -3.5, 1.1, 250], // on the roof of a parked car
    [50, -27, GROUND_Y, 100],
    [-54, 18, GROUND_Y, 150],
    [26, -84, GROUND_Y, 100],
  ];
  pickupSpots.forEach(([x, z, y, value], i) =>
    interactables.push({ id: `cash-${i}`, kind: "pickup", x, z, y, facing: 0, label: `apanhar $${value}`, value }),
  );

  const boxes: Box[] = [
    ...placements.flatMap(placementBoxes),
    ...walls,
    ...poles.map((p) => b(p.x - 0.18, p.x + 0.18, p.z - 0.18, p.z + 0.18, 0, p.height)),
    ...npcs.map((npc) => b(npc.x - NPC_RADIUS, npc.x + NPC_RADIUS, npc.z - NPC_RADIUS, npc.z + NPC_RADIUS, 0, 1.8)),
  ];

  return { placements, poles, walls, boxes, interactables, npcs, homeDoor };
}
