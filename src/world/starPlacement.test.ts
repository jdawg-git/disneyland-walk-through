import { describe, expect, it } from "vitest";
import { STARS } from "../config/scavenger";
import { landAt } from "../config/lands";
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
    const reachable = grid.reachableFrom(2, 285); // Town Square spawn
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
});
