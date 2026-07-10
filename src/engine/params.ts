/**
 * Dev/verification URL parameters.
 *
 *   ?cam=x,y,z,yaw,pitch  fixed camera (degrees), skips pointer lock + overlay
 *   &time=day|night       set lighting preset instantly (no transition)
 *   &date=2026-07-04      crowd-model date (stage 5)
 *   &hour=14              crowd-model hour (stage 5)
 *   &seed=42              PRNG seed for deterministic scatter
 *   &freeze=1             halt NPC/animation updates after first frames
 *   &hud=0                hide the HUD for clean captures
 *   &debug=map            top-down layout authoring view (stage 3)
 */

export interface CamParam {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yawDeg: number;
  readonly pitchDeg: number;
}

export interface AppParams {
  readonly cam: CamParam | null;
  readonly time: "day" | "night" | null;
  readonly date: string | null;
  readonly hour: number | null;
  readonly seed: number;
  readonly freeze: boolean;
  readonly hud: boolean;
  readonly debug: string | null;
}

export function parseParams(search: string): AppParams {
  const q = new URLSearchParams(search);

  let cam: CamParam | null = null;
  const camRaw = q.get("cam");
  if (camRaw !== null) {
    const parts = camRaw.split(",").map((s) => Number.parseFloat(s));
    const [x, y, z, yawDeg = 0, pitchDeg = 0] = parts;
    if (
      parts.length >= 3 &&
      x !== undefined &&
      y !== undefined &&
      z !== undefined &&
      parts.every((n) => Number.isFinite(n))
    ) {
      cam = { x, y, z, yawDeg, pitchDeg };
    }
  }

  const timeRaw = q.get("time");
  const time = timeRaw === "day" || timeRaw === "night" ? timeRaw : null;

  const hourRaw = q.get("hour");
  const hour = hourRaw !== null && Number.isFinite(Number(hourRaw)) ? Number(hourRaw) : null;

  const seedRaw = q.get("seed");
  const seed = seedRaw !== null && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : 1;

  return {
    cam,
    time,
    date: q.get("date"),
    hour,
    seed,
    freeze: q.get("freeze") === "1",
    hud: q.get("hud") !== "0",
    debug: q.get("debug"),
  };
}
