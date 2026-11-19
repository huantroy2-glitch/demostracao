import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { GameState } from "../state";
import type { OutfitKey } from "../sim/world";
import { CHARACTER_URLS } from "./assets";
import { OUTFITS } from "./outfits";
import { CharacterRig, prepareClips } from "./rig";

function useCharacterAssets() {
  const body = useGLTF(CHARACTER_URLS.body);
  const hair = useGLTF(CHARACTER_URLS.hair);
  const anims = useGLTF(CHARACTER_URLS.anims);
  const clips = useMemo(() => prepareClips(anims.animations), [anims]);
  return { body, hair, clips };
}

export function Actor({ id, outfit, game }: { id: string; outfit: OutfitKey; game: GameState }) {
  const { body, hair, clips } = useCharacterAssets();
  const rig = useMemo(() => new CharacterRig(body.scene, hair.scene, clips, OUTFITS[outfit]), [body, hair, clips, outfit]);
  useEffect(() => {
    game.rigs.set(id, rig);
    return () => {
      game.rigs.delete(id);
    };
  }, [game, id, rig]);
  return <primitive object={rig.group} />;
}

export function Actors({ game }: { game: GameState }) {
  return (
    <>
      <Actor id="player" outfit="hero" game={game} />
      {game.world.npcs.map((n) => (
        <Actor key={n.id} id={`npc-${n.id}`} outfit={n.outfit} game={game} />
      ))}
    </>
  );
}
