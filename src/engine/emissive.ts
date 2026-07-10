import type { MeshStandardMaterial } from "three";

/**
 * Registry of decorative "light" materials (windows, string lights, lanterns).
 * The park uses ZERO decorative point lights — everything glows via emissive
 * materials + bloom. dayNight drives a global boost (0 = day, ~2.5 = night)
 * and each material scales it by its own base intensity.
 */

interface EmissiveEntry {
  readonly material: MeshStandardMaterial;
  /** Intensity this material should reach at full night (boost 1.0 basis). */
  readonly nightIntensity: number;
  /** Intensity during the day (usually 0 — dark glass). */
  readonly dayIntensity: number;
}

const entries: EmissiveEntry[] = [];
let currentT = 0;

export function registerEmissive(
  material: MeshStandardMaterial,
  nightIntensity: number,
  dayIntensity = 0,
): void {
  entries.push({ material, nightIntensity, dayIntensity });
  // Materials can register after the initial preset is applied (scene builds
  // after the lighting rig) — honor the current blend immediately.
  material.emissiveIntensity = dayIntensity + (nightIntensity - dayIntensity) * currentT;
}

/** t: 0 = full day, 1 = full night. */
export function applyEmissiveBoost(t: number): void {
  currentT = t;
  for (const e of entries) {
    e.material.emissiveIntensity = e.dayIntensity + (e.nightIntensity - e.dayIntensity) * t;
  }
}
