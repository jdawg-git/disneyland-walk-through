import { describe, expect, it } from "vitest";
import { PARK_LAYOUT, pointInPolygon, polygonCentroid } from "./parkLayout";

/**
 * Guards the guest-map cull (scripts/filter-guest-map.ts): the committed
 * park-layout.json must contain only what the Disneyland guest map shows —
 * no backstage facilities, no Galaxy's Edge, nothing outside the boundary.
 */
describe("guest-map filtered layout", () => {
  it("keeps no backstage-named buildings", () => {
    const BACKSTAGE =
      /\bcast(?!le)|warehouse|\bplant\b|boiler|chiller|compressor|receiving|filtration|dry dock|break ?room|costuming|parking|refuel|powerhouse|roundhouse|show building|maintenance|storage|operators? booth|\btda\b|team disney/i;
    const offenders = PARK_LAYOUT.buildings
      .map((b) => b.name)
      .filter((n): n is string => n !== undefined)
      .filter((n) => n !== "Mickey's Toontown Depot" && BACKSTAGE.test(n));
    expect(offenders).toEqual([]);
  });

  it("keeps no Galaxy's Edge structures", () => {
    const GE =
      /star wars|millennium|falcon|first order|milk stand|tie echelon|x-wing|smuggler|launch bay|rise of the resist/i;
    const offenders = PARK_LAYOUT.buildings
      .map((b) => b.name)
      .filter((n): n is string => n !== undefined)
      .filter((n) => GE.test(n));
    expect(offenders).toEqual([]);
  });

  it("building count is in the guest-map band (cull actually ran)", () => {
    // Raw bake has 624; the guest map shows a few hundred structures
    // (street blocks, kiosks, ride facades).
    expect(PARK_LAYOUT.buildings.length).toBeGreaterThan(200);
    expect(PARK_LAYOUT.buildings.length).toBeLessThan(500);
  });

  it("every kept building centroid lies inside the guest boundary", () => {
    for (const b of PARK_LAYOUT.buildings) {
      const [cx, cz] = polygonCentroid(b.outer);
      expect(
        pointInPolygon(cx, cz, PARK_LAYOUT.boundary),
        `${b.name ?? b.id} at (${cx.toFixed(0)},${cz.toFixed(0)})`,
      ).toBe(true);
    }
  });

  it("keeps the guest anchors the map shows", () => {
    const names = new Set(
      PARK_LAYOUT.buildings.map((b) => b.name).filter((n) => n !== undefined),
    );
    for (const anchor of [
      "Sleeping Beauty Castle",
      "The Haunted Mansion",
      "Pirates of the Caribbean",
      "Matterhorn Bobsleds",
      '"it\'s a small world"',
      "Big Thunder Mountain Railroad",
      "Tiana's Bayou Adventure",
      "Jungle Cruise",
      "Emporium",
      "City Hall",
      "Plaza Inn",
      "Minnie's House",
      "Mickey's House",
      "Roger Rabbit's Car Toon Spin",
      "The Many Adventures of Winnie the Pooh",
      "Main Street Train Station",
      "Autopia",
      "Buzz Lightyear Astro Blasters",
    ]) {
      expect(names.has(anchor), anchor).toBe(true);
    }
  });

  it("railroad is narrow gauge only (no monorail/tram/abandoned)", () => {
    expect(PARK_LAYOUT.railroad.every((r) => r.kind === "narrow_gauge")).toBe(true);
  });
});
