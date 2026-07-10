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
});
