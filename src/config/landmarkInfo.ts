/**
 * POI metadata for the gaze-triggered HUD callout: what each landmark is
 * called, where it is (with an aim height so the view-cone test points at
 * the structure, not its doorstep), how far away it should trigger, and a
 * one-line blurb. Bespoke landmarks use the LANDMARKS anchors; a few
 * label-only rides (no bespoke mesh) are anchored to their filtered OSM
 * footprints.
 */

export interface LandmarkPoi {
  readonly id: string;
  readonly name: string;
  readonly land: string;
  readonly blurb: string;
  readonly x: number;
  /** Aim height — roughly mid-structure, so gazing UP at it still hits. */
  readonly y: number;
  readonly z: number;
  /** Trigger radius in meters (bigger for mountains you see from afar). */
  readonly range: number;
}

export const LANDMARK_POIS: readonly LandmarkPoi[] = [
  {
    id: "castle",
    name: "Sleeping Beauty Castle",
    land: "Fantasyland",
    blurb: "Walt's storybook castle — walk through to Fantasyland.",
    x: 5.8,
    y: 14,
    z: -12.2,
    range: 130,
  },
  {
    id: "trainStation",
    name: "Main Street Station",
    land: "Main Street, U.S.A.",
    blurb: "The Disneyland Railroad departs from above Town Square.",
    x: 2.6,
    y: 8,
    z: 300.2,
    range: 80,
  },
  {
    id: "matterhorn",
    name: "Matterhorn Bobsleds",
    land: "Fantasyland",
    blurb: "A 1/100-scale Alpine peak with bobsleds and a yeti inside.",
    x: 109,
    y: 30,
    z: -38.8,
    range: 170,
  },
  {
    id: "spaceMountain",
    name: "Space Mountain",
    land: "Tomorrowland",
    blurb: "A rocket race through the dark inside the white dome.",
    x: 151,
    y: 20,
    z: 162,
    range: 170,
  },
  {
    id: "tikiRoom",
    name: "Walt Disney's Enchanted Tiki Room",
    land: "Adventureland",
    blurb: "The birthplace of Audio-Animatronics — singing birds since 1963.",
    x: -53.2,
    y: 5,
    z: 114.3,
    range: 55,
  },
  {
    id: "piratesFacade",
    name: "Pirates of the Caribbean",
    land: "New Orleans Square",
    blurb: "Dead men tell no tales beyond this New Orleans manor.",
    x: -200.2,
    y: 8,
    z: 190.5,
    range: 70,
  },
  {
    id: "hauntedMansion",
    name: "The Haunted Mansion",
    land: "New Orleans Square",
    blurb: "999 happy haunts — but there's room for a thousand.",
    x: -301.8,
    y: 9,
    z: 120.2,
    range: 80,
  },
  {
    id: "bigThunder",
    name: "Big Thunder Mountain Railroad",
    land: "Frontierland",
    blurb: "The wildest ride in the wilderness, through red-rock hoodoos.",
    x: -124.2,
    y: 18,
    z: 3.8,
    range: 150,
  },
  {
    id: "smallWorld",
    name: "“it's a small world”",
    land: "Fantasyland",
    blurb: "The white-and-gold facade with the famous quarter-hour parade.",
    x: 114.3,
    y: 10,
    z: -247.7,
    range: 110,
  },
  {
    id: "tianasBayou",
    name: "Tiana's Bayou Adventure",
    land: "Bayou Country",
    blurb: "A five-story drop off the mossy bayou mountain.",
    x: -348,
    y: 16,
    z: 68,
    range: 150,
  },
  // --- Label-only rides (no bespoke mesh; anchored to OSM footprints) ---
  {
    id: "jungleCruise",
    name: "Jungle Cruise",
    land: "Adventureland",
    blurb: "The world-famous rivers of adventure (puns included).",
    x: -96,
    y: 4,
    z: 144,
    range: 50,
  },
  {
    id: "carrousel",
    name: "King Arthur Carrousel",
    land: "Fantasyland",
    blurb: "All 68 horses jump — pick your favorite.",
    x: 4,
    y: 5,
    z: -76,
    range: 60,
  },
  {
    id: "autopia",
    name: "Autopia",
    land: "Tomorrowland",
    blurb: "The freeway of the future, opened with the park in 1955.",
    x: 229,
    y: 4,
    z: 5,
    range: 80,
  },
  {
    id: "goldenHorseshoe",
    name: "The Golden Horseshoe",
    land: "Frontierland",
    blurb: "The longest-running stage show in showbiz history played here.",
    x: -106,
    y: 6,
    z: 88,
    range: 50,
  },
  {
    id: "operaHouse",
    name: "Main Street Opera House",
    land: "Main Street, U.S.A.",
    blurb: "Great Moments with Mr. Lincoln — the park's oldest building.",
    x: 55,
    y: 6,
    z: 274,
    range: 55,
  },
  {
    id: "tomSawyerIsland",
    name: "Pirate's Lair on Tom Sawyer Island",
    land: "Frontierland",
    blurb: "Rafts only — the island in the middle of the Rivers of America.",
    x: -249,
    y: 4,
    z: -12,
    range: 130,
  },
  {
    id: "partners",
    name: "Partners",
    land: "Central Plaza",
    blurb: "Walt and Mickey, at the heart of the park since 1993.",
    x: 1,
    y: 2.5,
    z: 55,
    range: 35,
  },
];
