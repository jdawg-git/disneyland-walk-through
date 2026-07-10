import { Scene } from "three";
import "./ui/base.css";
import { FirstPersonControls, EYE_HEIGHT } from "./engine/controls";
import { DayNightSystem } from "./engine/dayNight";
import { applyDebugCamera } from "./engine/debugCamera";
import { startLoop } from "./engine/loop";
import { parseParams, type AppParams } from "./engine/params";
import { createRenderer } from "./engine/renderer";
import { AudioZoneSystem } from "./systems/audioZones";
import { GuideSystem } from "./systems/guide";
import { ScavengerSystem } from "./systems/scavenger";
import { ZoneTracker } from "./systems/zoneTracker";
import { buildPark } from "./world/parkBuilder";
import { WalkableGrid } from "./world/walkable";
import { createHud } from "./ui/hud";
import { createStartOverlay } from "./ui/overlay";

declare global {
  interface Window {
    __PARK_READY__?: boolean;
  }
}

const params = parseParams(window.location.search);

if (params.debug === "map") {
  void import("./ui/debugMap").then(({ showDebugMap }) => {
    showDebugMap();
    window.__PARK_READY__ = true;
  });
} else {
  boot(params);
}

function boot(p: AppParams): void {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app container missing");

  const scene = new Scene();
  const bundle = createRenderer(app, scene);
  const dayNight = new DayNightSystem(scene);
  dayNight.bindBloom(bundle.setBloomIntensity);

  buildPark(scene, p.seed);
  const walkable = new WalkableGrid();

  const zones = new ZoneTracker();
  const audio = new AudioZoneSystem();
  zones.events.on("landChange", ({ land }) => {
    audio.setZone(land ? land.audioZone : null);
  });

  const scavenger = new ScavengerSystem(scene);
  const guide = new GuideSystem();

  // Applied after scene build so registered emissive materials pick it up.
  if (p.time) dayNight.setTime(p.time, true);

  // Spawn: Town Square, looking up Main Street toward the castle.
  const SPAWN = { x: 2, z: 285 };

  let controlsUpdate: (dt: number) => void = () => {};
  if (p.cam) {
    applyDebugCamera(bundle.camera, p.cam);
  } else {
    bundle.camera.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z);
    const controls = new FirstPersonControls(bundle.camera, bundle.renderer.domElement);
    controls.yaw = 0; // yaw 0 faces north (−Z), up Main Street toward the castle
    controls.collide = (from, to) => walkable.resolve(from, to);
    controlsUpdate = (dt) => controls.update(dt);
    createStartOverlay(bundle.renderer.domElement, () => audio.unlock());
  }

  if (p.hud) {
    createHud({
      dayNight,
      audio,
      scavenger,
      zones,
      guide,
      guideContext: () => ({
        land: zones.land,
        position: { x: bundle.camera.position.x, z: bundle.camera.position.z },
        timeOfDay: dayNight.timeOfDay,
        scavenger: {
          collected: scavenger.state.collected,
          total: scavenger.state.total,
        },
      }),
    });
  }

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code === "KeyN" && document.activeElement?.tagName !== "INPUT") dayNight.toggle();
  });

  let frames = 0;
  const frozen = p.freeze;
  startLoop((dt) => {
    if (!frozen || frames < 3) {
      controlsUpdate(dt);
      dayNight.update(dt);
      zones.update(dt, bundle.camera.position);
      scavenger.update(dt, bundle.camera.position);
    }
    bundle.render(dt);
    frames += 1;
    if (frames === 3) window.__PARK_READY__ = true;
  });
}
