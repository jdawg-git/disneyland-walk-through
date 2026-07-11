import { describe, expect, it } from "vitest";
import { STARS } from "../config/scavenger";
import { landAt } from "../config/lands";
import { PARK_LAYOUT } from "../data/parkLayout";
import { WalkableGrid } from "./walkable";

describe("scavenger star placement", () => {
  const grid = new WalkableGrid();

  it("has a star in (almost) every land, in sequence", () => {
    expect(STARS.length).toBeGreaterThanOrEqual(10);
    const landsVisited = new Set(
      STARS.map((s) => landAt(s.position[0], s.position[2])?.id).filter(Boolean),
    );
    expect(landsVisited.size).toBeGreaterThanOrEqual(8);
  });

  it("every star stands on walkable ground (player can reach it)", () => {
    for (const star of STARS) {
      const [x, , z] = star.position;
      expect(grid.isWalkable(x, z), `star ${star.id} at (${x}, ${z}) is not walkable`).toBe(true);
    }
  });

  it("every star has a non-empty clue", () => {
    for (const star of STARS) {
      expect(star.clue.length).toBeGreaterThan(20);
    }
  });

  it("every star is REACHABLE on foot from spawn (bridges + castle corridor connect)", () => {
    const reachable = grid.reachableFrom(2, 338); // entrance esplanade spawn
    for (const star of STARS) {
      const [x, , z] = star.position;
      expect(
        reachable(x, z),
        `star ${star.id} at (${x}, ${z}) is walkable but not connected to spawn`,
      ).toBe(true);
    }
  });

  it("the castle corridor connects the hub to Fantasyland directly", () => {
    const reachable = grid.reachableFrom(5.8, 20); // south of the castle gate
    // Just north of the castle, in the Fantasyland courtyard.
    expect(reachable(5.8, -40)).toBe(true);
  });

  it("lawns are walkable (grass does not block)", () => {
    // (1,55) itself is now the Partners statue pedestal; probe beside it.
    expect(grid.isWalkable(1, 60), "hub garden").toBe(true);
    expect(grid.isWalkable(-30, 290), "Town Square lawn").toBe(true);
  });

  it("most of the walkway network is reachable from spawn (no stuck pockets)", () => {
    const reachable = grid.reachableFrom(2, 338);

    // Walk lines (footways) — the residue skews backstage since real guest
    // surfaces moved to the plazas bucket in the Pass-4 re-bake.
    let total = 0;
    let ok = 0;
    for (const path of PARK_LAYOUT.paths) {
      if (path.kind !== "footway" && path.kind !== "pedestrian") continue;
      for (const p of path.points) {
        if (!landAt(p[0], p[1])) continue;
        total += 1;
        if (reachable(p[0], p[1])) ok += 1;
      }
    }
    expect(ok / total).toBeGreaterThan(0.75);

    // Plaza surfaces — the real guest areas; these must stay well connected.
    let plazaTotal = 0;
    let plazaOk = 0;
    for (const plaza of PARK_LAYOUT.plazas) {
      let cx = 0;
      let cz = 0;
      for (const p of plaza.outer) {
        cx += p[0];
        cz += p[1];
      }
      cx /= plaza.outer.length;
      cz /= plaza.outer.length;
      if (!landAt(cx, cz)) continue;
      plazaTotal += 1;
      if (reachable(cx, cz)) plazaOk += 1;
    }
    expect(plazaOk / plazaTotal).toBeGreaterThan(0.85);
  });
});
