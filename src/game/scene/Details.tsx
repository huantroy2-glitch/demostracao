// Animated details: the home door, its lit interior, pool water and cash pickups.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameState } from "../state";
import { GROUND_Y, POOL } from "../sim/world";
import { banknoteTexture, waterNormalTexture, woodDoorTexture } from "./textures";

export function HomeDoor({ game }: { game: GameState }) {
  const d = game.world.homeDoor;
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const t = woodDoorTexture();
    return {
      leaf: new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }),
      room: new THREE.MeshStandardMaterial({ color: "#6b4a33", emissive: "#3a2312", roughness: 1, side: THREE.BackSide }),
      floor: new THREE.MeshStandardMaterial({ color: "#5b3b28", emissive: "#24150b", roughness: 0.9 }),
      lamp: new THREE.MeshBasicMaterial({ color: "#ffd9a0" }),
    };
  }, []);
  useFrame(() => {
    const a = game.doorOpen * 1.65;
    if (left.current) left.current.rotation.y = a;
    if (right.current) right.current.rotation.y = -a;
  });
  const leafW = d.width / 2;
  return (
    <group position={[d.x, GROUND_Y, d.z]}>
      <group ref={left} position={[-leafW, 0, 0]}>
        <mesh position={[leafW / 2, d.height / 2, -0.03]} material={mats.leaf} castShadow>
          <boxGeometry args={[leafW - 0.02, d.height - 0.02, 0.05]} />
        </mesh>
        <mesh position={[leafW - 0.12, d.height * 0.45, 0.01]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <group ref={right} position={[leafW, 0, 0]}>
        <mesh position={[-leafW / 2, d.height / 2, -0.03]} material={mats.leaf} castShadow>
          <boxGeometry args={[leafW - 0.02, d.height - 0.02, 0.05]} />
        </mesh>
        <mesh position={[-leafW + 0.12, d.height * 0.45, 0.01]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      {/* Warm hallway seen through the open door. */}
      <mesh position={[0, 1.4, -1.6]} material={mats.room}>
        <boxGeometry args={[2.8, 2.8, 3]} />
      </mesh>
      <mesh position={[0, 0.005, -1.6]} rotation-x={-Math.PI / 2} material={mats.floor}>
        <planeGeometry args={[2.8, 3]} />
      </mesh>
      <mesh position={[0.6, 2.5, -2.6]} material={mats.lamp}>
        <sphereGeometry args={[0.12, 12, 12]} />
      </mesh>
    </group>
  );
}

export function Water() {
  const mat = useMemo(() => {
    const n = waterNormalTexture();
    n.repeat.set(2.5, 1.6);
    return new THREE.MeshStandardMaterial({
      color: "#2c97b8",
      roughness: 0.06,
      metalness: 0.15,
      transparent: true,
      opacity: 0.8,
      normalMap: n,
      normalScale: new THREE.Vector2(0.45, 0.45),
      depthWrite: false,
    });
  }, []);
  useFrame((_, dt) => {
    const n = mat.normalMap!;
    n.offset.x += dt * 0.025;
    n.offset.y += dt * 0.017;
  });
  const w = POOL.maxX - POOL.minX;
  const h = POOL.maxZ - POOL.minZ;
  return (
    <mesh position={[(POOL.minX + POOL.maxX) / 2, POOL.surface, (POOL.minZ + POOL.maxZ) / 2]} rotation-x={-Math.PI / 2} material={mat} renderOrder={2}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

export function Pickups({ game }: { game: GameState }) {
  const items = useMemo(() => game.world.interactables.filter((i) => i.kind === "pickup"), [game]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mats = useMemo(() => {
    const t = banknoteTexture();
    return {
      top: new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: "#3c6a2c", emissiveIntensity: 0.35 }),
      side: new THREE.MeshStandardMaterial({ color: "#d9e6c8", roughness: 0.8 }),
      band: new THREE.MeshStandardMaterial({ color: "#c9a24a", roughness: 0.5, metalness: 0.4 }),
      glow: new THREE.MeshBasicMaterial({ color: "#9df07a", transparent: true, opacity: 0.22, depthWrite: false }),
    };
  }, []);
  const stackMats = useMemo(() => [mats.side, mats.side, mats.top, mats.top, mats.side, mats.side], [mats]);
  useFrame(() => {
    const t = game.time;
    items.forEach((it, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.visible = !game.collected.has(it.id);
      g.rotation.y = t * 1.6 + i;
      g.position.y = (it.kind === "pickup" ? it.y : 0) + 0.75 + Math.sin(t * 2.2 + i) * 0.08;
    });
  });
  return (
    <>
      {items.map((it, i) => (
        <group key={it.id} ref={(el) => (refs.current[i] = el)} position={[it.x, 0.8, it.z]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, k * 0.055, 0]} rotation-y={k * 0.25} material={stackMats} castShadow>
              <boxGeometry args={[0.34, 0.05, 0.17]} />
            </mesh>
          ))}
          <mesh position={[0, 0.06, 0]} material={mats.band}>
            <boxGeometry args={[0.06, 0.17, 0.18]} />
          </mesh>
          <mesh material={mats.glow} position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.38, 16, 12]} />
          </mesh>
        </group>
      ))}
    </>
  );
}
