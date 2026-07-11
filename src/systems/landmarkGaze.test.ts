import { describe, expect, it } from "vitest";
import { selectGazePoi, type GazeCamera } from "./landmarkGaze";
import type { LandmarkPoi } from "../config/landmarkInfo";

const poi = (id: string, x: number, z: number, range = 100, y = 10): LandmarkPoi => ({
  id,
  name: id,
  land: "Testland",
  blurb: "",
  x,
  y,
  z,
  range,
});

/** Camera at origin (eye height 1.7) looking straight at the given point. */
const lookingAt = (x: number, y: number, z: number): GazeCamera => {
  const len = Math.hypot(x, y - 1.7, z);
  return { x: 0, y: 1.7, z: 0, fx: x / len, fy: (y - 1.7) / len, fz: z / len };
};

describe("landmark gaze selection", () => {
  it("picks a POI dead ahead within range", () => {
    const p = poi("castle", 0, -50);
    expect(selectGazePoi(lookingAt(0, 10, -50), [p], null)?.id).toBe("castle");
  });

  it("stays silent when the POI is behind the camera", () => {
    const p = poi("castle", 0, -50);
    expect(selectGazePoi(lookingAt(0, 10, 50), [p], null)).toBeNull();
  });

  it("stays silent beyond range", () => {
    const p = poi("castle", 0, -500, 100);
    expect(selectGazePoi(lookingAt(0, 10, -500), [p], null)).toBeNull();
  });

  it("stays silent when looking well off to the side", () => {
    const p = poi("castle", 0, -50);
    // Looking 90° away (east) while the castle is north.
    expect(selectGazePoi(lookingAt(50, 10, 0), [p], null)).toBeNull();
  });

  it("picks the most-centered of two candidates", () => {
    const ahead = poi("ahead", 0, -60);
    const offside = poi("offside", 18, -60);
    expect(selectGazePoi(lookingAt(0, 10, -60), [ahead, offside], null)?.id).toBe("ahead");
  });

  it("hysteresis: keeps the current pick when gaze drifts slightly off-center", () => {
    const p = poi("castle", 0, -50);
    // ~25° off — outside the acquire cone but inside the stay cone.
    const drifted = lookingAt(23, 10, -50);
    expect(selectGazePoi(drifted, [p], null)).toBeNull(); // can't acquire here
    expect(selectGazePoi(drifted, [p], "castle")?.id).toBe("castle"); // but holds
  });

  it("hysteresis: a rival must be clearly more centered to steal", () => {
    const held = poi("held", 8, -60);
    const rival = poi("rival", 0, -60);
    // Looking between them, marginally favoring the rival: held survives...
    const cam = lookingAt(3, 10, -60);
    expect(selectGazePoi(cam, [held, rival], "held")?.id).toBe("held");
    // ...but looking straight at the rival hands it over.
    expect(selectGazePoi(lookingAt(0, 10, -60), [held, rival], "held")?.id).toBe("rival");
  });

  it("drops the pick once the gaze leaves the stay cone", () => {
    const p = poi("castle", 0, -50);
    // ~45° off — outside even the stay cone.
    expect(selectGazePoi(lookingAt(50, 10, -50), [p], "castle")).toBeNull();
  });
});
