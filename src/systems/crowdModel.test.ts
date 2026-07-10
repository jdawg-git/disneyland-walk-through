import { describe, expect, it } from "vitest";
import { crowdForecast, npcCount } from "./crowdModel";

describe("crowdForecast", () => {
  it("is deterministic", () => {
    expect(crowdForecast("2026-07-04")).toEqual(crowdForecast("2026-07-04"));
  });

  it("peaks on Christmas week", () => {
    expect(crowdForecast("2026-12-25").level).toBe(10);
    expect(crowdForecast("2026-12-28").level).toBe(10);
  });

  it("labels holidays by name", () => {
    expect(crowdForecast("2026-07-04").label).toContain("Independence Day");
    expect(crowdForecast("2026-07-04").label).toContain("9/10");
  });

  it("mid-January weekday is quiet", () => {
    // 2026-01-14 is a Wednesday: 5 × 0.85 ≈ 4.
    const { level } = crowdForecast("2026-01-14");
    expect(level).toBeLessThanOrEqual(4);
  });

  it("early September weekday is the quietest stretch", () => {
    // 2026-09-16 is a Wednesday: 4.5 × 0.85 ≈ 4.
    expect(crowdForecast("2026-09-16").level).toBeLessThanOrEqual(4);
  });

  it("October Saturday is near-peak without an override", () => {
    // 2026-10-17 is a Saturday: 8.5 × 1.25 → 10 (clamped).
    expect(crowdForecast("2026-10-17").level).toBeGreaterThanOrEqual(9);
  });

  it("weekends beat midweek in the same month", () => {
    const saturday = crowdForecast("2026-06-06").level;
    const wednesday = crowdForecast("2026-06-10").level;
    expect(saturday).toBeGreaterThan(wednesday);
  });

  it("clamps to 1..10 and handles bad input", () => {
    expect(crowdForecast("not-a-date").level).toBe(5);
    for (const d of ["2026-02-03", "2026-12-25", "2026-09-16"]) {
      const { level } = crowdForecast(d);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(10);
    }
  });
});

describe("npcCount", () => {
  it("scales with level", () => {
    expect(npcCount(10, 14)).toBeGreaterThan(npcCount(5, 14));
    expect(npcCount(5, 14)).toBeGreaterThan(npcCount(1, 14));
  });

  it("scales with time of day (midday > early morning > night)", () => {
    expect(npcCount(8, 14)).toBeGreaterThan(npcCount(8, 8));
    expect(npcCount(8, 8)).toBeGreaterThan(npcCount(8, 2));
  });

  it("never returns zero (a theme park is never truly empty)", () => {
    expect(npcCount(1, 3)).toBeGreaterThan(0);
  });
});
