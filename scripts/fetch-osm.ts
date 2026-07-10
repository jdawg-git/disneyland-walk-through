/**
 * Build-time OSM ingestion: fetches Disneyland Park geometry from the
 * Overpass API, projects it to local meters, simplifies, classifies, and
 * bakes src/data/park-layout.json. The baked file is COMMITTED — runtime has
 * zero network dependency and this script is a maintenance command only.
 *
 *   npm run fetch:osm
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Park bbox (south, west, north, east) — Disneyland Park, Anaheim.
const BBOX = "33.8090,-117.9250,33.8180,-117.9130" as const;

// Local-meter origin: Central Plaza (hub) center. +X east, -Z north.
const ORIGIN = { lat: 33.8127, lon: -117.919 } as const;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
] as const;

const QUERY = `
[out:json][timeout:120][bbox:${BBOX}];
(
  way["building"];
  way["highway"~"^(footway|path|pedestrian|steps)$"];
  way["natural"="water"];
  way["waterway"];
  way["railway"];
  way["attraction"];
  way["leisure"~"^(garden|park)$"];
  way["landuse"="grass"];
  relation["building"];
  relation["natural"="water"];
  relation["attraction"];
);
out geom;
relation(5586855);  // "Disneyland" tourism=theme_park boundary relation
out geom;
`;

interface OverpassPoint {
  readonly lat: number;
  readonly lon: number;
}

interface OverpassWay {
  readonly type: "way";
  readonly id: number;
  readonly tags?: Record<string, string>;
  readonly geometry?: readonly OverpassPoint[];
}

interface OverpassRelationMember {
  readonly type: string;
  readonly role: string;
  readonly geometry?: readonly OverpassPoint[];
}

interface OverpassRelation {
  readonly type: "relation";
  readonly id: number;
  readonly tags?: Record<string, string>;
  readonly members?: readonly OverpassRelationMember[];
}

type OverpassElement = OverpassWay | OverpassRelation;

interface OverpassResponse {
  readonly elements: readonly OverpassElement[];
}

type Pt = readonly [number, number];

interface BakedBuilding {
  readonly id: number;
  readonly name?: string;
  readonly levels?: number;
  readonly height?: number;
  readonly outer: readonly Pt[];
  readonly inner?: readonly (readonly Pt[])[];
}

interface BakedPath {
  readonly id: number;
  readonly kind: string;
  readonly points: readonly Pt[];
}

interface BakedWater {
  readonly id: number;
  readonly name?: string;
  readonly outer: readonly Pt[];
  readonly inner?: readonly (readonly Pt[])[];
}

interface BakedRail {
  readonly id: number;
  readonly name?: string;
  readonly kind: string;
  readonly points: readonly Pt[];
}

interface BakedAttraction {
  readonly id: number;
  readonly name: string;
  readonly center: Pt;
  readonly outline?: readonly Pt[];
}

interface BakedGreen {
  readonly id: number;
  readonly outer: readonly Pt[];
}

interface ParkLayout {
  readonly origin: { readonly lat: number; readonly lon: number };
  readonly boundary: readonly Pt[];
  readonly buildings: readonly BakedBuilding[];
  readonly paths: readonly BakedPath[];
  readonly water: readonly BakedWater[];
  readonly railroad: readonly BakedRail[];
  readonly attractions: readonly BakedAttraction[];
  readonly greens: readonly BakedGreen[];
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

function project(p: OverpassPoint): Pt {
  const x = (p.lon - ORIGIN.lon) * M_PER_DEG_LON;
  const z = -(p.lat - ORIGIN.lat) * M_PER_DEG_LAT;
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}

function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

/** Douglas–Peucker; keeps first/last points. */
function simplify(points: readonly Pt[], tolerance: number): Pt[] {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return [...points];
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (!p) continue;
    const d = perpDistance(p, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = simplify(points.slice(0, maxIdx + 1), tolerance);
  const right = simplify(points.slice(maxIdx), tolerance);
  return [...left.slice(0, -1), ...right];
}

function centroid(points: readonly Pt[]): Pt {
  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p[0];
    sz += p[1];
  }
  return [sx / points.length, sz / points.length];
}

function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (!a || !b) continue;
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

/** Stitch relation member ways (by role) into closed rings. */
function assembleRings(
  members: readonly OverpassRelationMember[],
  role: "outer" | "inner",
): Pt[][] {
  const segments: Pt[][] = members
    .filter((m) => m.role === role && m.geometry && m.geometry.length >= 2)
    .map((m) => (m.geometry ?? []).map(project));

  const rings: Pt[][] = [];
  while (segments.length > 0) {
    const seed = segments.shift();
    if (!seed) break;
    const ring = [...seed];
    let closed = false;
    let progressed = true;
    while (!closed && progressed) {
      progressed = false;
      const head = ring[0];
      const tail = ring[ring.length - 1];
      if (!head || !tail) break;
      if (Math.hypot(head[0] - tail[0], head[1] - tail[1]) < 0.5 && ring.length > 3) {
        closed = true;
        break;
      }
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg) continue;
        const s0 = seg[0];
        const s1 = seg[seg.length - 1];
        if (!s0 || !s1) continue;
        const near = (a: Pt, b: Pt): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
        if (near(tail, s0)) {
          ring.push(...seg.slice(1));
          segments.splice(i, 1);
          progressed = true;
          break;
        }
        if (near(tail, s1)) {
          ring.push(...[...seg].reverse().slice(1));
          segments.splice(i, 1);
          progressed = true;
          break;
        }
        if (near(head, s1)) {
          ring.unshift(...seg.slice(0, -1));
          segments.splice(i, 1);
          progressed = true;
          break;
        }
        if (near(head, s0)) {
          ring.unshift(...[...seg].reverse().slice(0, -1));
          segments.splice(i, 1);
          progressed = true;
          break;
        }
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

// ---------------------------------------------------------------------------
// Fetch with mirror rotation + retries (Overpass endpoints can 406/429).
// ---------------------------------------------------------------------------

async function fetchOverpass(): Promise<OverpassResponse> {
  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const mirror = MIRRORS[attempt % MIRRORS.length];
    if (!mirror) continue;
    try {
      console.log(`Overpass attempt ${attempt + 1} via ${new URL(mirror).host} ...`);
      const res = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass instances reject requests without a descriptive UA.
          "User-Agent": "disneyland-virtual-build/0.1 (personal project; one-shot layout bake)",
        },
        body: `data=${encodeURIComponent(QUERY)}`,
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        const waitMs = res.status === 429 ? 15000 : 4000 * (attempt + 1);
        console.warn(`  ${lastError}; retrying in ${waitMs / 1000}s`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      const json = (await res.json()) as OverpassResponse;
      if (!Array.isArray(json.elements)) throw new Error("malformed response");
      return json;
    } catch (err) {
      lastError = String(err);
      console.warn(`  ${lastError}; retrying`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`Overpass fetch failed after retries: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const data = await fetchOverpass();
console.log(`Fetched ${data.elements.length} elements`);

// 1. Park boundary — theme_park relation (fall back to convex-ish bbox ring).
let boundary: Pt[] = [];
for (const el of data.elements) {
  if (el.type === "relation" && el.tags?.["tourism"] === "theme_park") {
    const rings = assembleRings(el.members ?? [], "outer");
    rings.sort((a, b) => b.length - a.length);
    boundary = simplify(rings[0] ?? [], 0.5);
    break;
  }
}
if (boundary.length < 4) {
  console.warn("No theme_park boundary found — using bbox rectangle");
  const [s = 0, w = 0, n = 0, e = 0] = BBOX.split(",").map(Number);
  boundary = [
    project({ lat: s, lon: w }),
    project({ lat: s, lon: e }),
    project({ lat: n, lon: e }),
    project({ lat: n, lon: w }),
  ];
}

const insidePark = (points: readonly Pt[]): boolean =>
  points.some((p) => pointInPolygon(p, boundary));

const buildings: BakedBuilding[] = [];
const paths: BakedPath[] = [];
const water: BakedWater[] = [];
const railroad: BakedRail[] = [];
const attractions: BakedAttraction[] = [];
const greens: BakedGreen[] = [];

const pickName = (tags: Record<string, string> | undefined): string | undefined =>
  tags?.["name"];

for (const el of data.elements) {
  const tags = el.tags ?? {};

  if (el.type === "way") {
    const raw = (el.geometry ?? []).map(project);
    if (raw.length < 2) continue;
    if (!insidePark(raw)) continue;

    if (tags["building"] !== undefined) {
      const outer = simplify(raw, 0.4);
      if (outer.length < 4) continue;
      const name = pickName(tags);
      const levelsRaw = tags["building:levels"];
      const heightRaw = tags["height"];
      const levels = levelsRaw !== undefined && Number.isFinite(Number(levelsRaw)) ? Number(levelsRaw) : undefined;
      const height = heightRaw !== undefined && Number.isFinite(Number.parseFloat(heightRaw)) ? Number.parseFloat(heightRaw) : undefined;
      buildings.push({
        id: el.id,
        ...(name !== undefined ? { name } : {}),
        ...(levels !== undefined ? { levels } : {}),
        ...(height !== undefined ? { height } : {}),
        outer,
      });
    } else if (tags["highway"] !== undefined) {
      const pts = simplify(raw, 0.4);
      paths.push({ id: el.id, kind: tags["highway"] ?? "footway", points: pts });
    } else if (tags["natural"] === "water" || tags["waterway"] !== undefined) {
      const outer = simplify(raw, 0.5);
      if (outer.length >= 4) {
        const name = pickName(tags);
        water.push({ id: el.id, ...(name !== undefined ? { name } : {}), outer });
      }
    } else if (tags["railway"] !== undefined) {
      {
        const name = pickName(tags);
        railroad.push({
          id: el.id,
          kind: tags["railway"] ?? "rail",
          ...(name !== undefined ? { name } : {}),
          points: simplify(raw, 0.5),
        });
      }
    } else if (tags["attraction"] !== undefined) {
      const name = pickName(tags);
      if (name !== undefined) {
        attractions.push({
          id: el.id,
          name,
          center: centroid(raw),
          outline: simplify(raw, 1.0),
        });
      }
    } else if (
      tags["leisure"] === "garden" ||
      tags["leisure"] === "park" ||
      tags["landuse"] === "grass"
    ) {
      const outer = simplify(raw, 0.6);
      if (outer.length >= 4) greens.push({ id: el.id, outer });
    }
  } else if (el.type === "relation" && el.tags?.["tourism"] !== "theme_park") {
    // Multipolygon buildings / water.
    const outers = assembleRings(el.members ?? [], "outer");
    const inners = assembleRings(el.members ?? [], "inner");
    outers.sort((a, b) => b.length - a.length);
    const outerRaw = outers[0];
    if (!outerRaw || outerRaw.length < 4) continue;
    if (!insidePark(outerRaw)) continue;
    const outer = simplify(outerRaw, 0.4);
    const inner = inners.map((r) => simplify(r, 0.4)).filter((r) => r.length >= 4);

    const relName = pickName(tags);
    if (tags["building"] !== undefined) {
      buildings.push({
        id: el.id,
        ...(relName !== undefined ? { name: relName } : {}),
        outer,
        ...(inner.length > 0 ? { inner } : {}),
      });
    } else if (tags["natural"] === "water") {
      water.push({
        id: el.id,
        ...(relName !== undefined ? { name: relName } : {}),
        outer,
        ...(inner.length > 0 ? { inner } : {}),
      });
    } else if (tags["attraction"] !== undefined && relName !== undefined) {
      attractions.push({
        id: el.id,
        name: relName,
        center: centroid(outer),
        outline: outer,
      });
    }
  }
}

const layout: ParkLayout = {
  origin: ORIGIN,
  boundary,
  buildings,
  paths,
  water,
  railroad,
  attractions,
  greens,
};

const outFile = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "park-layout.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(layout));

console.log(
  `Baked park-layout.json: ${buildings.length} buildings, ${paths.length} paths, ` +
    `${water.length} water, ${railroad.length} rail, ${attractions.length} attractions, ` +
    `${greens.length} greens, boundary ${boundary.length} pts`,
);
const named = buildings.filter((b) => b.name !== undefined).map((b) => b.name);
console.log(`Named buildings (${named.length}): ${named.slice(0, 40).join(" | ")}`);
