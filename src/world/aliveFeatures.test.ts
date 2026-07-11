import { describe, expect, it } from "vitest";
import { stitchRailLoop } from "./train";
import { PARK_LAYOUT, polygonCentroid } from "../data/parkLayout";
import { WalkableGrid } from "./walkable";

describe("railroad loop", () => {
  it("stitches the narrow-gauge segments into one near-closed loop", () => {
    const { points, closureGap } = stitchRailLoop();
    expect(points.length).toBeGreaterThan(100);
    // The closed CatmullRom bridges the station gap; keep it tight.
    expect(closureGap).toBeLessThan(50);
  });

  it("the loop actually rings the park (spans all four sides)", () => {
    const { points } = stitchRailLoop();
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    expect(Math.min(...xs)).toBeLessThan(-300);
    expect(Math.max(...xs)).toBeGreaterThan(250);
    expect(Math.min(...zs)).toBeLessThan(-300);
    expect(Math.max(...zs)).toBeGreaterThan(250);
  });
});

describe("Tom Sawyer Island", () => {
  it("exists in the data as the river's inner ring", () => {
    const river = PARK_LAYOUT.water.find((w) => w.name === "Rivers of America");
    expect(river?.inner?.[0]?.length ?? 0).toBeGreaterThan(8);
  });

  it("is UNREACHABLE on foot (scenery only)", () => {
    const river = PARK_LAYOUT.water.find((w) => w.name === "Rivers of America");
    const ring = river?.inner?.[0];
    expect(ring).toBeDefined();
    if (!ring) return;
    const [cx, cz] = polygonCentroid(ring);
    const grid = new WalkableGrid();
    const reachable = grid.reachableFrom(2, 338); // entrance spawn
    expect(reachable(cx, cz)).toBe(false);
  });
});
