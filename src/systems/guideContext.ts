import { LANDS, type LandDef } from "../config/lands";
import { LANDMARKS } from "../config/landmarks";
import { PARK_LAYOUT } from "../data/parkLayout";

/**
 * Spatial context assembly for the tour guide: a table of landmarks with
 * distance + compass bearing + player-relative direction, so the LLM can
 * give real directions ("head left past the castle toward Tomorrowland").
 *
 * Convention: north = −Z, east = +X. Player yaw 0 faces north; compass
 * heading = (−yawDeg + 360) % 360.
 */

interface PoiEntry {
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

const LANDMARK_NAMES: Record<string, string> = {
  castle: "Sleeping Beauty Castle",
  trainStation: "Main Street Station",
  matterhorn: "the Matterhorn",
  spaceMountain: "Space Mountain",
  tikiRoom: "the Enchanted Tiki Room",
  piratesFacade: "Pirates of the Caribbean",
  hauntedMansion: "the Haunted Mansion",
  bigThunder: "Big Thunder Mountain",
  smallWorld: "it's a small world",
  splashMountain: "Splash Mountain",
};

function buildPoiTable(): PoiEntry[] {
  const entries = new Map<string, PoiEntry>();
  for (const landmark of LANDMARKS) {
    const name = LANDMARK_NAMES[landmark.key] ?? landmark.key;
    entries.set(name.toLowerCase(), { name, x: landmark.position[0], z: landmark.position[1] });
  }
  for (const attraction of PARK_LAYOUT.attractions) {
    const key = attraction.name.toLowerCase();
    if (!entries.has(key)) {
      entries.set(key, { name: attraction.name, x: attraction.center[0], z: attraction.center[1] });
    }
  }
  return [...entries.values()];
}

const POI_TABLE = buildPoiTable();
const WINDS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export function compassWord(bearingDeg: number): string {
  const idx = Math.round(((bearingDeg % 360) + 360) % 360 / 45) % 8;
  return WINDS[idx] ?? "north";
}

export function bearingDeg(fromX: number, fromZ: number, toX: number, toZ: number): number {
  const east = toX - fromX;
  const north = -(toZ - fromZ);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

function relativeWord(bearing: number, headingDeg: number): string {
  const diff = ((bearing - headingDeg + 540) % 360) - 180; // -180..180
  const abs = Math.abs(diff);
  if (abs < 30) return "straight ahead";
  if (abs > 150) return "behind you";
  if (diff > 0) return abs > 100 ? "back and to your right" : "to your right";
  return abs > 100 ? "back and to your left" : "to your left";
}

export interface GuideSnapshot {
  readonly land: LandDef | null;
  readonly x: number;
  readonly z: number;
  readonly headingDeg: number;
  readonly timeOfDay: "day" | "night";
  readonly crowdLabel: string;
  readonly scavengerCollected: number;
  readonly scavengerTotal: number;
  readonly currentClue: string | null;
}

/** Render the live park state as plain text for the system prompt. */
export function renderContext(s: GuideSnapshot): string {
  const lines: string[] = [];
  lines.push(`Player location: ${s.land ? s.land.name : "a backstage area"} (park coordinates x=${s.x.toFixed(0)}, z=${s.z.toFixed(0)}; north is -z).`);
  lines.push(`Player is facing ${compassWord(s.headingDeg)}.`);
  lines.push(`Time: ${s.timeOfDay}. Crowds today: ${s.crowdLabel}.`);
  lines.push(
    `Scavenger hunt: ${s.scavengerCollected}/${s.scavengerTotal} golden stars found.` +
      (s.currentClue ? ` Current clue: "${s.currentClue}"` : " Hunt complete!"),
  );
  lines.push("");
  lines.push("Lands: " + LANDS.map((l) => l.name).join(", ") + ".");
  lines.push("");
  lines.push("Landmarks and attractions (distance, compass direction, direction relative to where the player faces):");
  const sorted = [...POI_TABLE]
    .map((poi) => {
      const d = Math.hypot(poi.x - s.x, poi.z - s.z);
      const b = bearingDeg(s.x, s.z, poi.x, poi.z);
      return { poi, d, b };
    })
    .sort((a, b) => a.d - b.d);
  for (const { poi, d, b } of sorted) {
    lines.push(
      `- ${poi.name}: ${Math.round(d)} m ${compassWord(b)}, ${relativeWord(b, s.headingDeg)}`,
    );
  }
  return lines.join("\n");
}
