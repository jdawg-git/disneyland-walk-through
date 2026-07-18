/**
 * Guest-map filter: reduce the raw OSM bake (everything physically in
 * Anaheim — backstage warehouses, cast facilities, TDA offices, Galaxy's
 * Edge) down to what the Disneyland guest map actually shows.
 *
 *   npm run filter:map     src/data/park-layout.raw.json → src/data/park-layout.json
 *
 * Guest area = inside the DLRR berm ring (buffered outward 15 m; bowed out
 * over the entrance forecourt, Toontown, and Critter Country, which all sit
 * beyond the tracks). Galaxy's Edge falls outside the ring naturally (the
 * 2019 DLRR reroute skirts its south edge), so the berm cull removes it.
 * Named buildings additionally pass a backstage-name cull, plus a manual
 * id skip-list for unnamed show-building slabs spotted in verify renders.
 * The emitted `boundary` becomes the guest boundary, so terrain pavement
 * and the walkable grid shrink to the guest area automatically.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stitchNarrowGaugeRing, bufferRing } from "../src/data/railLoop";
import type { Pt } from "../src/data/parkLayout";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");

interface RawLayout {
  origin: { lat: number; lon: number };
  boundary: Pt[];
  buildings: { id: number; name?: string; levels?: number; height?: number; outer: Pt[]; inner?: Pt[][] }[];
  paths: { id: number; kind: string; points: Pt[] }[];
  water: { id: number; name?: string; outer: Pt[]; inner?: Pt[][] }[];
  railroad: { id: number; kind: string; points: Pt[] }[];
  attractions: { id: number; name: string; center: Pt }[];
  greens: { id: number; kind: string; outer: Pt[] }[];
  plazas: { id: number; outer: Pt[] }[];
  amenities: { kind: string; at: Pt }[];
}

const raw = JSON.parse(readFileSync(join(DATA_DIR, "park-layout.raw.json"), "utf8")) as RawLayout;

// ---------------------------------------------------------------------------
// Guest boundary: DLRR berm ring, buffered, with entrance forecourt spliced
// in and the Galaxy's Edge pocket clamped out.
// ---------------------------------------------------------------------------

const { points: ring, closureGap } = stitchNarrowGaugeRing(raw.railroad);
if (ring.length < 20 || closureGap > 60) {
  throw new Error(`rail ring unusable: ${ring.length} pts, gap ${closureGap.toFixed(1)} m`);
}

// NOTE on Galaxy's Edge: the post-2019 DLRR reroute skirts GE's SOUTH edge,
// so the entire GE pocket already lies OUTSIDE the rail ring — the berm
// cull removes it with no dedicated carve-out needed.
const guestRing: Pt[] = bufferRing(ring, 15).map(([x, z]) => {
  // Entrance forecourt: bow the south arc out over Town Square approach +
  // the esplanade spawn (z≈338).
  if (z > 280 && x > -75 && x < 85) return [x, 348] as Pt;
  // Toontown and the it's-a-small-world mall sit OUTSIDE the rail ring
  // (guests duck under the berm) — bow the north arc over them (Minnie's
  // House z≈-317, Runaway Railway facade z≈-357, Small World show building
  // z≈-248), stopping short of the backstage row at z≈-416.
  if (z < -215 && x > -95 && x < 125) return [x, -385] as Pt;
  // Critter Country similarly pokes west beyond the ring (Winnie the Pooh
  // x≈-391, Hungry Bear terrace) — bow the west arc out to the treeline.
  if (x < -300 && z > -80 && z < 120) return [-450, z] as Pt;
  return [x, z] as Pt;
});

function inPolygon(x: number, z: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    if (a[1] > z !== b[1] > z) {
      const ix = ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0];
      if (x < ix) inside = !inside;
    }
  }
  return inside;
}

const inGuestArea = (x: number, z: number): boolean => inPolygon(x, z, guestRing);

const centroid = (pts: readonly Pt[]): Pt => {
  let x = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    z += p[1];
  }
  return [x / pts.length, z / pts.length];
};

// ---------------------------------------------------------------------------
// Backstage building cull (inside the berm there are still cast facilities
// and ride show-buildings the guest map never shows).
// ---------------------------------------------------------------------------

const BACKSTAGE_NAME =
  /\bcast(?!le)|warehouse|\bplant\b|boiler|chiller|compressor|receiving|\bfos\b|filtration|dry dock|break ?room|costuming|parking|refuel|powerhouse|horticulture|roundhouse|show building|maintenance|storage|substation|operators? booth|greaters? booth|wheelchair|elevator platform|vending|parade building|circle d|\boffice\b|\bshed\b|facility|ostrich|eat ticket|train engineer|guide \d|disable elevator|\btda\b|team disney/i;

/** Guest-facing names the regex would otherwise eat. */
const KEEP_NAMES = new Set(["Mickey's Toontown Depot", "Telegraph Office"]);

/** Stale OSM names remapped to what the guest map shows today. */
const RENAME = new Map<string, string>([["Star Wars: Launch Bay", "Tomorrowland Theater"]]);

/**
 * Show-building slabs / leftovers identified in verify renders (extend as
 * more are spotted). Landmark footprints are skipped at render time via
 * LANDMARKS[].osmIds, not here.
 */
const SKIP_IDS = new Set<number>([
  // Indiana Jones Adventure show building: a 131×169 m warehouse whose
  // centroid is in Adventureland but which sprawls far OUTSIDE the berm
  // (the aerial's "stray slab"). The map shows only a modest entrance.
  824031782,
  // v6 walkthrough: the unnamed slab BETWEEN Star Tours and Buzz Lightyear
  // — in Anaheim that's an open walkway into Tomorrowland, not a wall.
  371961449,
  // v6 walkthrough: Autopia reads as a car track with ONE queue building;
  // OSM's cluster of unnamed service structures cluttered the whole zone
  // (the named Autopia queue building 168833464 stays).
  133727770, 133953688, 134713125, 146334830, 146334834, 146334836,
  191893859, 191893874, 288608886, 316758022,
]);

/**
 * Guest-map-phantom walkways (v6 walkthrough): OSM traces cast-member
 * routes behind both Main Street blocks; the guest map shows no opening
 * there. Culling them removes the walkable carve AND the tan ribbon.
 */
const SKIP_PATH_IDS = new Set<number>([
  // West alley behind the Emporium block + its backstage door stubs.
  384305677, 563788122, 617915226, 130219718, 130219729, 136352886,
  151099927, 151099942, 156766158, 156766166, 301206248, 1409618625,
  1409618627, 1409618628, 1409618629, 1409622503, 1473988282,
  // East-side gap north of Town Square ("that's not an opening").
  310706962, 384305678, 358814103, 136353325,
]);

/** Ponds the walkthrough flagged as pinching the Tomorrowland entrance. */
const SKIP_WATER_IDS = new Set<number>([
  157975863, // Pixie Hollow Lagoon — crowds the entry walkway
  139512951, // unnamed pond just north of it, same pinch
]);

const dropped: Record<string, number> = {};
const drop = (bucket: string): void => {
  dropped[bucket] = (dropped[bucket] ?? 0) + 1;
};

/** Polygon area (m²) for the micro-footprint cull below. */
const polyArea = (pts: readonly Pt[]): number => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += ((pts[j]?.[0] ?? 0) + (pts[i]?.[0] ?? 0)) * ((pts[j]?.[1] ?? 0) - (pts[i]?.[1] ?? 0));
  }
  return Math.abs(a / 2);
};

const buildings = raw.buildings
  .filter((b) => {
    const [cx, cz] = centroid(b.outer);
    if (!inGuestArea(cx, cz)) {
      drop("building:outside");
      return false;
    }
    if (SKIP_IDS.has(b.id)) {
      drop("building:skiplist");
      return false;
    }
    // Dumbo the Flying Elephant: OSM maps every RIDE VEHICLE as its own
    // tiny building — extruded, they read as a Stonehenge ring around the
    // spinner. Drop micro-footprints near the Dumbo anchor (8, -107); the
    // bespoke elephant spinner in rides.ts replaces them.
    if (polyArea(b.outer) < 40 && Math.hypot(cx - 8, cz + 107) < 16) {
      drop("building:dumbo-vehicle");
      return false;
    }
    if (b.name && !KEEP_NAMES.has(b.name) && BACKSTAGE_NAME.test(b.name)) {
      drop("building:backstage-name");
      return false;
    }
    return true;
  })
  .map((b) => (b.name && RENAME.has(b.name) ? { ...b, name: RENAME.get(b.name) } : b));

// Paths: keep runs of consecutive in-area points so nothing dangles into
// backstage; a crossing path splits into its inside pieces.
const paths: RawLayout["paths"] = [];
for (const p of raw.paths) {
  if (SKIP_PATH_IDS.has(p.id)) {
    drop("path:skiplist");
    continue;
  }
  let run: Pt[] = [];
  const flush = (): void => {
    if (run.length >= 2) paths.push({ id: p.id, kind: p.kind, points: run });
    run = [];
  };
  for (const pt of p.points) {
    if (inGuestArea(pt[0], pt[1])) run.push(pt);
    else flush();
  }
  flush();
  if (run.length === 0 && !paths.some((q) => q.id === p.id)) drop("path:outside");
}

const water = raw.water.filter((w) => {
  // Backstage ride-vehicle storage ponds — never on the guest map.
  if (w.name !== undefined && /boat storage/i.test(w.name)) {
    drop("water:backstage");
    return false;
  }
  if (SKIP_WATER_IDS.has(w.id)) {
    drop("water:skiplist");
    return false;
  }
  const [cx, cz] = centroid(w.outer);
  if (inGuestArea(cx, cz)) return true;
  drop("water:outside");
  return false;
});

const railroad = raw.railroad.filter((r) => {
  if (r.kind !== "narrow_gauge") {
    drop(`rail:${r.kind}`);
    return false;
  }
  // Yard spurs (roundhouse leads) sit fully outside the guest ring — drop
  // them so no orphan berm renders in the void.
  if (!r.points.some((p) => inGuestArea(p[0], p[1]))) {
    drop("rail:spur");
    return false;
  }
  return true;
});

const attractions = raw.attractions.filter((a) => {
  if (inGuestArea(a.center[0], a.center[1])) return true;
  drop("attraction:outside");
  return false;
});

const greens = raw.greens.filter((g) => {
  const [cx, cz] = centroid(g.outer);
  if (inGuestArea(cx, cz)) return true;
  drop("green:outside");
  return false;
});

const plazas = raw.plazas.filter((p) => {
  const [cx, cz] = centroid(p.outer);
  if (inGuestArea(cx, cz)) return true;
  drop("plaza:outside");
  return false;
});

const amenities = raw.amenities.filter((a) => {
  if (inGuestArea(a.at[0], a.at[1])) return true;
  drop("amenity:outside");
  return false;
});

const filtered = {
  origin: raw.origin,
  boundary: guestRing.map(([x, z]) => [Number(x.toFixed(2)), Number(z.toFixed(2))]),
  buildings,
  paths,
  water,
  railroad,
  attractions,
  greens,
  plazas,
  amenities,
};

writeFileSync(join(DATA_DIR, "park-layout.json"), JSON.stringify(filtered));

console.log(`guest ring: ${guestRing.length} pts (closure gap ${closureGap.toFixed(1)} m)`);
console.log("kept:");
console.log(`  buildings   ${buildings.length} / ${raw.buildings.length}`);
console.log(`  paths       ${paths.length} / ${raw.paths.length}`);
console.log(`  water       ${water.length} / ${raw.water.length}`);
console.log(`  railroad    ${railroad.length} / ${raw.railroad.length}`);
console.log(`  attractions ${attractions.length} / ${raw.attractions.length}`);
console.log(`  greens      ${greens.length} / ${raw.greens.length}`);
console.log(`  plazas      ${plazas.length} / ${raw.plazas.length}`);
console.log(`  amenities   ${amenities.length} / ${raw.amenities.length}`);
console.log("dropped:", JSON.stringify(dropped, null, 2));
