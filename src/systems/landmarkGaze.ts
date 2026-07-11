import type { LandmarkPoi } from "../config/landmarkInfo";

/**
 * Gaze + proximity POI selection for the landmark HUD callout: a POI is a
 * candidate when the camera is within its range AND it sits inside a ~22°
 * view cone; the most-centered candidate wins. Hysteresis keeps the
 * current pick sticky — it survives out to a wider cone and slightly
 * longer range, and a rival must be clearly more centered to steal the
 * nameplate — so the label doesn't flicker between neighboring landmarks.
 *
 * Pure over its inputs (camera pose + POI list + previous pick) so it's
 * unit-testable without three.js.
 */

const COS_ENTER = 0.93; // ~21.5° half-angle to acquire
const COS_STAY = 0.82; // ~35° half-angle before the current pick drops
const STAY_RANGE_FACTOR = 1.2; // current pick survives slightly past range
const STEAL_MARGIN = 0.005; // rival must be this much more centered

export interface GazeCamera {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Normalized world-space view direction. */
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
}

function alignment(cam: GazeCamera, poi: LandmarkPoi): { cos: number; dist: number } {
  const dx = poi.x - cam.x;
  const dy = poi.y - cam.y;
  const dz = poi.z - cam.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-3) return { cos: 1, dist };
  const cos = (dx * cam.fx + dy * cam.fy + dz * cam.fz) / dist;
  return { cos, dist };
}

export function selectGazePoi(
  cam: GazeCamera,
  pois: readonly LandmarkPoi[],
  currentId: string | null,
): LandmarkPoi | null {
  let best: LandmarkPoi | null = null;
  let bestCos = -Infinity;
  let current: LandmarkPoi | null = null;
  let currentCos = -Infinity;

  for (const poi of pois) {
    const { cos, dist } = alignment(cam, poi);
    if (poi.id === currentId && dist < poi.range * STAY_RANGE_FACTOR && cos > COS_STAY) {
      current = poi;
      currentCos = cos;
    }
    if (dist < poi.range && cos > COS_ENTER && cos > bestCos) {
      best = poi;
      bestCos = cos;
    }
  }

  // Sticky: keep the current pick unless a rival is clearly more centered.
  if (current && (!best || best.id === current.id || bestCos < currentCos + STEAL_MARGIN)) {
    return current;
  }
  return best;
}
