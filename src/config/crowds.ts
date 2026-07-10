/**
 * Editable crowd model. Final level for a date =
 *   clamp(round(HOLIDAYS[date] ?? MONTH_BASELINE[month] × DOW_MULTIPLIER[dow]), 1, 10)
 * NPC density additionally scales by TIME_OF_DAY_CURVE[hour].
 *
 * TODO(calibration): Thrill Data's 2026 Disneyland crowd calendar
 * (https://www.thrill-data.com/trip-planning/crowd-calendar/disneyland)
 * sits behind a Cloudflare challenge and could not be fetched at build
 * time. The values below follow the documented seasonal shape (summer +
 * holidays high; mid-January and early September low) cross-checked
 * against Mickey Visit's 2026 monthly pattern (Oct + late Dec busiest,
 * Feb/Sep quietest). Correct any month against the live calendar by
 * editing MONTH_BASELINE — 1 (empty) to 10 (packed).
 */

/** Month (1–12) → baseline crowd level 1–10. */
export const MONTH_BASELINE: Record<number, number> = {
  1: 5, // post-holiday drop; mid-Jan is quiet (early Jan handled by HOLIDAYS)
  2: 4.5,
  3: 7, // spring break ramps up
  4: 7.5, // Easter/spring break peak
  5: 6,
  6: 6.5,
  7: 7,
  8: 5.5,
  9: 4.5, // quietest stretch after Labor Day
  10: 8.5, // Halloween season — busiest regular month
  11: 5.5, // quiet except Thanksgiving week
  12: 8, // builds all month to the Christmas peak
};

/** Day of week (0 = Sunday … 6 = Saturday) → multiplier. */
export const DOW_MULTIPLIER: Record<number, number> = {
  0: 1.15,
  1: 0.95,
  2: 0.85,
  3: 0.85,
  4: 0.9,
  5: 1.1,
  6: 1.25,
};

/** "YYYY-MM-DD" → absolute level override (replaces baseline × dow). */
export const HOLIDAYS: Record<string, number> = {
  "2026-01-01": 10,
  "2026-01-02": 9,
  "2026-01-03": 9,
  "2026-02-14": 8, // Presidents Day weekend
  "2026-02-15": 8,
  "2026-02-16": 8,
  "2026-04-03": 9, // Easter (Apr 5) / spring break peak week
  "2026-04-04": 9,
  "2026-04-05": 9,
  "2026-04-06": 8,
  "2026-05-23": 8, // Memorial Day weekend
  "2026-05-24": 8,
  "2026-05-25": 8,
  "2026-07-03": 9,
  "2026-07-04": 9, // Independence Day
  "2026-09-05": 7, // Labor Day weekend
  "2026-09-06": 7,
  "2026-09-07": 8,
  "2026-10-12": 9, // Indigenous Peoples' Day — notoriously packed
  "2026-10-31": 10, // Halloween
  "2026-11-26": 9, // Thanksgiving week
  "2026-11-27": 9,
  "2026-11-28": 9,
  "2026-12-24": 10,
  "2026-12-26": 10,
  "2026-12-27": 10,
  "2026-12-28": 10,
  "2026-12-29": 10,
  "2026-12-30": 10,
  "2026-12-31": 10,
  "2026-12-25": 10,
};

/** Friendly names for HUD labels. */
export const HOLIDAY_NAMES: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-02-16": "Presidents Day",
  "2026-04-05": "Easter",
  "2026-05-25": "Memorial Day",
  "2026-07-04": "Independence Day",
  "2026-09-07": "Labor Day",
  "2026-10-12": "Indigenous Peoples' Day",
  "2026-10-31": "Halloween",
  "2026-11-26": "Thanksgiving",
  "2026-12-25": "Christmas",
  "2026-12-31": "New Year's Eve",
};

/** Hour (0–23) → NPC density factor (midday peak). */
export const TIME_OF_DAY_CURVE: readonly number[] = [
  0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.2, // 0–7
  0.4, 0.6, 0.75, 0.88, 0.95, 1.0, 1.0, 0.95, // 8–15
  0.9, 0.85, 0.8, 0.75, 0.65, 0.5, 0.3, 0.15, // 16–23
];

/** Hard cap on rendered NPCs (level 10, midday). */
export const MAX_NPCS = 1500;
