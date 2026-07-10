import type { PerspectiveCamera } from "three";
import type { CamParam } from "./params";

/**
 * Fixed camera for the automated screenshot harness (?cam=x,y,z,yaw,pitch).
 * Bypasses pointer lock entirely so headless Chromium can capture
 * deterministic viewpoints.
 */
export function applyDebugCamera(camera: PerspectiveCamera, cam: CamParam): void {
  camera.position.set(cam.x, cam.y, cam.z);
  camera.rotation.set(
    (cam.pitchDeg * Math.PI) / 180,
    (cam.yawDeg * Math.PI) / 180,
    0,
    "YXZ",
  );
}
