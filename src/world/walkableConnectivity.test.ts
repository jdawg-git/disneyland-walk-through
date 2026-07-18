import { describe, expect, it } from "vitest";
import { PARK_LAYOUT } from "../data/parkLayout";
import { SPAWN, WalkableGrid } from "./walkable";

/**
 * v6: the grid seals every pocket unreachable from spawn, so a player can
 * never slip into a dead-end canyon between show buildings (the Tomorrowland
 * "I'm totally stuck" playtest report). These tests pin that contract.
 */
describe("walkable connectivity (sealed grid)", () => {
  const grid = new WalkableGrid();

  it("every walkable cell is reachable from spawn — no sealed-off pockets", () => {
    const reachable = grid.reachableFrom(SPAWN.x, SPAWN.z);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of PARK_LAYOUT.boundary) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[1]);
      maxZ = Math.max(maxZ, p[1]);
    }
    // Sample the whole park on a 1 m lattice: walkable must imply reachable.
    let walkableCells = 0;
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (!grid.isWalkable(x, z)) continue;
        walkableCells += 1;
        if (!reachable(x, z)) {
          expect.fail(`walkable cell (${x}, ${z}) is not reachable from spawn`);
        }
      }
    }
    expect(walkableCells).toBeGreaterThan(10000); // sanity: park is still open
  });

  it("spawn itself is walkable", () => {
    expect(grid.isWalkable(SPAWN.x, SPAWN.z)).toBe(true);
  });

  it("Tom Sawyer Island is sealed (raft-only in the real park)", () => {
    // Island center sits inside the Rivers of America; with pockets sealed
    // it must read blocked so players can't be routed onto it.
    expect(grid.isWalkable(-217, 80)).toBe(false);
  });
});
