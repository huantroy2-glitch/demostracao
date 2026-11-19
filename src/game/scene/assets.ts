import type { ModelKey } from "../sim/world";
import hero from "@/assets/models/hero.glb.asset.json";
import heroHair from "@/assets/models/hero-hair.glb.asset.json";
import heroAnims from "@/assets/models/hero-anims.glb.asset.json";
import house1 from "@/assets/models/house-1story.glb.asset.json";
import house2gable from "@/assets/models/house-2story-gable.glb.asset.json";
import house2side from "@/assets/models/house-2story-side.glb.asset.json";
import house2stairs from "@/assets/models/house-2story-stairs.glb.asset.json";
import carSedan from "@/assets/models/car-sedan.glb.asset.json";
import carSedan2 from "@/assets/models/car-sedan-2.glb.asset.json";
import carCoupe from "@/assets/models/car-coupe.glb.asset.json";
import palm1 from "@/assets/models/palm-1.glb.asset.json";
import palm3 from "@/assets/models/palm-3.glb.asset.json";
import palm4 from "@/assets/models/palm-4.glb.asset.json";
import streetLight from "@/assets/models/street-light.glb.asset.json";
import hydrant from "@/assets/models/fire-hydrant.glb.asset.json";
import bench from "@/assets/models/bench.glb.asset.json";
import trashBin from "@/assets/models/trash-bin.glb.asset.json";
import dumpster from "@/assets/models/dumpster.glb.asset.json";
import skyA from "@/assets/models/skyscraper-a.glb.asset.json";
import skyB from "@/assets/models/skyscraper-b.glb.asset.json";
import skyD from "@/assets/models/skyscraper-d.glb.asset.json";
import skyE from "@/assets/models/skyscraper-e.glb.asset.json";
import asphaltColor from "@/assets/textures/asphalt_color.jpg.asset.json";
import asphaltNormal from "@/assets/textures/asphalt_normal.jpg.asset.json";
import sidewalkColor from "@/assets/textures/sidewalk_color.jpg.asset.json";
import sidewalkNormal from "@/assets/textures/sidewalk_normal.jpg.asset.json";
import grassColor from "@/assets/textures/grass_color.jpg.asset.json";
import grassNormal from "@/assets/textures/grass_normal.jpg.asset.json";

export const CHARACTER_URLS = { body: hero.url, hair: heroHair.url, anims: heroAnims.url };

export const MODEL_URLS: Record<ModelKey, string> = {
  house1: house1.url,
  house2gable: house2gable.url,
  house2side: house2side.url,
  house2stairs: house2stairs.url,
  carSedan: carSedan.url,
  carSedan2: carSedan2.url,
  carCoupe: carCoupe.url,
  palm1: palm1.url,
  palm3: palm3.url,
  palm4: palm4.url,
  streetLight: streetLight.url,
  hydrant: hydrant.url,
  bench: bench.url,
  trashBin: trashBin.url,
  dumpster: dumpster.url,
  skyA: skyA.url,
  skyB: skyB.url,
  skyD: skyD.url,
  skyE: skyE.url,
};

export const TEXTURE_URLS = {
  asphaltColor: asphaltColor.url,
  asphaltNormal: asphaltNormal.url,
  sidewalkColor: sidewalkColor.url,
  sidewalkNormal: sidewalkNormal.url,
  grassColor: grassColor.url,
  grassNormal: grassNormal.url,
};
