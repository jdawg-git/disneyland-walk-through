import { Scene } from "three";
import "./ui/base.css";
import { FirstPersonControls, EYE_HEIGHT } from "./engine/controls";
import { DayNightSystem } from "./engine/dayNight";
import { applyDebugCamera } from "./engine/debugCamera";
import { startLoop } from "./engine/loop";
import { parseParams } from "./engine/params";
import { createRenderer } from "./engine/renderer";
import { buildTestScene } from "./world/testScene";
import { createStartOverlay } from "./ui/overlay";

declare global {
  interface Window {
    __PARK_READY__?: boolean;
  }
}

const params = parseParams(window.location.search);
const app = document.getElementById("app");
if (!app) throw new Error("#app container missing");

const scene = new Scene();
const bundle = createRenderer(app, scene);
const dayNight = new DayNightSystem(scene);
dayNight.bindBloom(bundle.setBloomIntensity);
if (params.time) dayNight.setTime(params.time, true);

buildTestScene(scene, params.seed);

let controlsUpdate: (dt: number) => void = () => {};
if (params.cam) {
  // Screenshot/verification mode: fixed camera, no pointer lock, no overlay.
  applyDebugCamera(bundle.camera, params.cam);
} else {
  bundle.camera.position.set(0, EYE_HEIGHT, 20);
  const controls = new FirstPersonControls(bundle.camera, bundle.renderer.domElement);
  controlsUpdate = (dt) => controls.update(dt);
  createStartOverlay(bundle.renderer.domElement, () => {
    // Audio unlock hook lands here in stage 2 (same user gesture as lock).
  });
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.code === "KeyN") dayNight.toggle();
});

let frames = 0;
const frozen = params.freeze;
startLoop((dt) => {
  if (!frozen || frames < 3) {
    controlsUpdate(dt);
    dayNight.update(dt);
  }
  bundle.render(dt);
  frames += 1;
  if (frames === 3) window.__PARK_READY__ = true;
});
