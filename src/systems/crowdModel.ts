import {
  DOW_MULTIPLIER,
  HOLIDAYS,
  HOLIDAY_NAMES,
  MONTH_BASELINE,
  MAX_NPCS,
  TIME_OF_DAY_CURVE,
} from "../config/crowds";

export interface CrowdForecast {
  /** 1–10, deterministic for a given date. */
  readonly level: number;
  /** e.g. "Independence Day — Level 9/10" or "Saturday — Level 7/10". */
  readonly label: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Parse "YYYY-MM-DD" as a local date (avoids UTC off-by-one). */
function parseLocalDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Deterministic crowd level for a "YYYY-MM-DD" date. */
export function crowdForecast(dateStr: string): CrowdForecast {
  const date = parseLocalDate(dateStr);
  if (!date) return { level: 5, label: "Level 5/10" };

  const override = HOLIDAYS[dateStr];
  let raw: number;
  if (override !== undefined) {
    raw = override;
  } else {
    const baseline = MONTH_BASELINE[date.getMonth() + 1] ?? 5;
    const dow = DOW_MULTIPLIER[date.getDay()] ?? 1;
    raw = baseline * dow;
  }
  const level = Math.max(1, Math.min(10, Math.round(raw)));

  const holidayName = HOLIDAY_NAMES[dateStr];
  const dayName = DAY_NAMES[date.getDay()] ?? "";
  const label = `${holidayName ?? dayName} — Level ${level}/10`;
  return { level, label };
}

/** Target rendered NPC count for a level at a given hour. */
export function npcCount(level: number, hour: number): number {
  const clampedLevel = Math.max(1, Math.min(10, level));
  const timeFactor = TIME_OF_DAY_CURVE[Math.max(0, Math.min(23, Math.floor(hour)))] ?? 1;
  // Quadratic-ish ramp: level 1 feels near-empty, level 10 packed.
  const base = MAX_NPCS * Math.pow(clampedLevel / 10, 1.6);
  return Math.max(6, Math.round(base * timeFactor));
}
