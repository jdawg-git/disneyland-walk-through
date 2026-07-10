import { describe, expect, it } from "vitest";
import { bearingDeg, compassWord, renderContext } from "./guideContext";
import { landAt } from "../config/lands";

describe("guide spatial context", () => {
  it("computes compass bearings correctly (north = -z, east = +x)", () => {
    expect(compassWord(bearingDeg(0, 0, 0, -100))).toBe("north");
    expect(compassWord(bearingDeg(0, 0, 100, 0))).toBe("east");
    expect(compassWord(bearingDeg(0, 0, 0, 100))).toBe("south");
    expect(compassWord(bearingDeg(0, 0, -100, 0))).toBe("west");
  });

  it("places landmarks correctly from the hub (1, 55)", () => {
    // Matterhorn (109, -38.8) is northeast of the hub.
    expect(compassWord(bearingDeg(1, 55, 109, -38.8))).toBe("northeast");
    // Main Street Station (2.6, 300) is south.
    expect(compassWord(bearingDeg(1, 55, 2.6, 300.2))).toBe("south");
    // Pirates (-200, 190) is southwest.
    expect(compassWord(bearingDeg(1, 55, -200.2, 190.5))).toBe("southwest");
    // The castle (5.8, -12.2) is north.
    expect(compassWord(bearingDeg(1, 55, 5.8, -12.2))).toBe("north");
  });

  it("renders a context block with player-relative directions", () => {
    const text = renderContext({
      land: landAt(1, 55),
      x: 1,
      z: 55,
      headingDeg: 0, // facing north, toward the castle
      timeOfDay: "night",
      crowdLabel: "Saturday — Level 7/10",
      scavengerCollected: 3,
      scavengerTotal: 12,
      currentClue: "Head west through the gateway of adventure…",
    });
    expect(text).toContain("Central Plaza");
    expect(text).toContain("facing north");
    // Facing north from the hub, the castle is straight ahead…
    expect(text).toMatch(/Sleeping Beauty Castle: \d+ m north, straight ahead/);
    // …and the train station is behind.
    expect(text).toMatch(/Main Street Station: \d+ m south, behind you/);
    expect(text).toContain("3/12 golden stars");
  });
});
