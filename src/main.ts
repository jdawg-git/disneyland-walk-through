import { Scene } from "three";
import "./ui/base.css";
import { FirstPersonControls, EYE_HEIGHT } from "./engine/controls";
import { DayNightSystem } from "./engine/dayNight";
import { updateAll } from "./engine/updatables";
import { applyDebugCamera } from "./engine/debugCamera";
import { startLoop } from "./engine/loop";
import { parseParams, type AppParams } from "./engine/params";
import { createRenderer } from "./engine/renderer";
import { AudioZoneSystem } from "./systems/audioZones";
import { crowdForecast, npcCount } from "./systems/crowdModel";
import { GuideSystem } from "./systems/guide";
import { ScavengerSystem } from "./systems/scavenger";
import { ZoneTracker } from "./systems/zoneTracker";
import { CrowdSystem } from "./world/crowd";
import { buildPark } from "./world/parkBuilder";
import { WalkableGrid } from "./world/walkable";
import { createHud } from "./ui/hud";
import { createStartOverlay } from "./ui/overlay";

declare global {
  interface Window {
    __PARK_READY__?: boolean;
    __PARK_STATS__?: () => { calls: number; triangles: number };
    /** Debug handle for the verify harness (raycast inspection). */
    __PARK_SCENE__?: Scene;
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
  window.__PARK_STATS__ = () => ({
    calls: bundle.renderer.info.render.calls,
    triangles: bundle.renderer.info.render.triangles,
  });
  window.__PARK_SCENE__ = scene;
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

  // Crowd simulation: a typical average day, always. The historical-date
  // model still backs the ?date=YYYY-MM-DD&hour=H dev params (used by the
  // verify harness), but there is no in-game date picker.
  const AVERAGE_LEVEL = 6;
  const crowd = new CrowdSystem(scene, p.seed);
  const forecast = p.date
    ? crowdForecast(p.date)
    : { level: AVERAGE_LEVEL, label: `A typical day — Level ${AVERAGE_LEVEL}/10` };
  crowd.setCount(npcCount(forecast.level, p.hour ?? 14));

  // Applied after scene build so registered emissive materials pick it up.
  if (p.time) dayNight.setTime(p.time, true);

  // Spawn: the entrance esplanade, outside the gate, facing the station —
  // you arrive at the park the way real guests do.
  const SPAWN = { x: 2, z: 338 };

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
      guideContext: () => {
        const s = scavenger.state;
        return {
          land: zones.land,
          x: bundle.camera.position.x,
          z: bundle.camera.position.z,
          headingDeg: ((-bundle.camera.rotation.y * 180) / Math.PI + 360) % 360,
          timeOfDay: dayNight.timeOfDay,
          crowdLabel: forecast.label,
          scavengerCollected: s.collected,
          scavengerTotal: s.total,
          currentClue: s.clue,
        };
      },
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
      crowd.update(dt);
      updateAll(dt);
    }
    bundle.render(dt);
    frames += 1;
    if (frames === 3) window.__PARK_READY__ = true;
  });
}
