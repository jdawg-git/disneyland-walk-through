import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { registerUpdatable } from "../engine/updatables";
import { LANDS, landAt } from "../config/lands";
import { PARK_LAYOUT, pointInPolygon, polygonCentroid, type Pt } from "../data/parkLayout";
import { rippleTexture } from "./textures";
import { flatPolygonGeometry, mergeFlatGeometries } from "./shapeUtil";

/**
 * Ground layering (bottom to top, tiny y offsets to avoid z-fighting):
 *   earth plane (outside the berm) → park pavement (boundary polygon) →
 *   planter greens → water. The park floor is pavement-first because
 *   Disneyland is mostly paved; greens and water carve into it.
 */
export function buildTerrain(scene: Scene): void {
  const earth = new Mesh(
    new PlaneGeometry(2400, 2400),
    new MeshStandardMaterial({ color: 0x6f7a58, roughness: 1 }),
  );
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -0.05;
  earth.receiveShadow = true;
  scene.add(earth);

  const pavement = new Mesh(
    flatPolygonGeometry(PARK_LAYOUT.boundary),
    new MeshStandardMaterial({ color: 0xb5a894, roughness: 0.95 }),
  );
  pavement.receiveShadow = true;
  scene.add(pavement);

  // Per-land ground tint (Main Street red concrete, Tomorrowland cool
  // concrete, …) with the real OSM plaza surfaces rendered slightly
  // lighter on top — the walkway layout finally reads as designed streets.
  const plazaMaterials = new Map<string, MeshStandardMaterial>();
  const white = new Color(0xffffff);
  for (const land of LANDS) {
    const groundMesh = new Mesh(
      flatPolygonGeometry(land.polygon),
      new MeshStandardMaterial({ color: land.ground, roughness: 0.98 }),
    );
    groundMesh.position.y = 0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const plazaColor = new Color(land.ground).lerp(white, 0.16);
    plazaMaterials.set(
      land.id,
      new MeshStandardMaterial({ color: plazaColor, roughness: 0.92 }),
    );
  }
  // Merge the hundreds of plaza rings into one mesh per land material —
  // individually they were ~200 draw calls.
  const defaultPlazaMaterial = new MeshStandardMaterial({ color: 0xc4b8a4, roughness: 0.92 });
  const plazaGeos = new Map<string, ReturnType<typeof flatPolygonGeometry>[]>();
  for (const plaza of PARK_LAYOUT.plazas) {
    const c = polygonCentroid(plaza.outer);
    const land = landAt(c[0], c[1]);
    const key = land && plazaMaterials.has(land.id) ? land.id : "__default";
    let bucketList = plazaGeos.get(key);
    if (!bucketList) {
      bucketList = [];
      plazaGeos.set(key, bucketList);
    }
    bucketList.push(flatPolygonGeometry(plaza.outer));
  }
  for (const [key, geos] of plazaGeos) {
    const merged = mergeFlatGeometries(geos);
    if (!merged) continue;
    const mesh = new Mesh(merged, plazaMaterials.get(key) ?? defaultPlazaMaterial);
    mesh.position.y = 0.05;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // All planter greens merge into a single mesh (~630 rings otherwise).
  const grassMaterial = new MeshStandardMaterial({ color: 0x6f9c4e, roughness: 1 });
  const grassMerged = mergeFlatGeometries(PARK_LAYOUT.greens.map((g) => flatPolygonGeometry(g.outer)));
  if (grassMerged) {
    const mesh = new Mesh(grassMerged, grassMaterial);
    mesh.position.y = 0.08;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Water with a slow scrolling ripple sheen.
  const waterMaterial = new MeshStandardMaterial({
    color: 0x4a86c0,
    roughness: 0.25,
    metalness: 0.1,
    map: rippleTexture(),
    emissive: new Color(0x16304e),
    emissiveIntensity: 0,
  });
  registerEmissive(waterMaterial, 0.5); // faint moonlit sheen at night
  const ripple = waterMaterial.map;
  if (ripple) {
    ripple.repeat.set(0.045, 0.045);
    registerUpdatable((dt) => {
      ripple.offset.x += dt * 0.012;
      ripple.offset.y += dt * 0.008;
    });
  }
  const waterMerged = mergeFlatGeometries(
    PARK_LAYOUT.water.map((w) => flatPolygonGeometry(w.outer, w.inner)),
  );
  if (waterMerged) {
    const mesh = new Mesh(waterMerged, waterMaterial);
    mesh.position.y = 0.13;
    scene.add(mesh);
  }

  buildWalkways(scene);
  buildBridgeDecks(scene);
}

/**
 * Wooden decks wherever a real walkway crosses water, so bridges read as
 * bridges instead of walking on the water plane. One instanced unit box,
 * stretched per crossing segment.
 */
function buildBridgeDecks(scene: Scene): void {
  interface Deck {
    readonly mid: Vector3;
    readonly yaw: number;
    readonly length: number;
    /** Cross-bridge width multiplier (geometry is 3.4 m wide at 1). */
    readonly width?: number;
  }
  const decks: Deck[] = [];
  const overWater = (x: number, z: number): boolean =>
    PARK_LAYOUT.water.some((w) => pointInPolygon(x, z, w.outer));

  // The castle drawbridge is hand-placed below, aligned with the castle's
  // walk-through corridor (world x 3.2..8.4, center 5.8) — the OSM moat
  // crossing sits a few meters west of the arch and looked misaligned.
  const CASTLE_BRIDGE = { x: 5.8, z: 4 };

  for (const path of PARK_LAYOUT.paths) {
    if (path.kind !== "footway" && path.kind !== "pedestrian" && path.kind !== "steps") continue;
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      const midX = (a[0] + b[0]) / 2;
      const midZ = (a[1] + b[1]) / 2;
      if (!overWater(midX, midZ) && !overWater(a[0], a[1]) && !overWater(b[0], b[1])) continue;
      if (Math.hypot(midX - CASTLE_BRIDGE.x, midZ - CASTLE_BRIDGE.z) < 12) continue;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      decks.push({
        mid: new Vector3(midX, 0.17, midZ),
        yaw: Math.atan2(-dz, dx), // unit-x box aligned along the segment
        length: length + 1.2, // overlap onto both banks
      });
    }
  }
  // Drawbridge: north-south deck dead-center on the corridor, spanning the
  // moat in front of the gate (castle south face ≈ z −1; moat to z ≈ 9).
  decks.push({
    mid: new Vector3(CASTLE_BRIDGE.x, 0.17, CASTLE_BRIDGE.z),
    yaw: Math.PI / 2, // unit-x box turned to run north-south
    length: 14,
    width: 1.6, // ≈5.4 m — matches the 5 m corridor
  });
  if (decks.length === 0) return;

  const deckMaterial = new MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
  const mesh = new InstancedMesh(new BoxGeometry(1, 0.12, 3.4), deckMaterial, decks.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const scale = new Vector3();
  decks.forEach((d, i) => {
    q.setFromAxisAngle(up, d.yaw);
    scale.set(d.length, 1, d.width ?? 1);
    m.compose(d.mid, q, scale);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/**
 * Visible walkway ribbons: the guest map's defining feature is its tan
 * path network, but until now paths existed only as carved WALKABLE space
 * with no rendered surface (the Toontown walkway was literally invisible).
 * One merged mesh of flat quads along every footway/pedestrian polyline.
 */
function buildWalkways(scene: Scene): void {
  const HALF_WIDTH = 2.2;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const push = (x: number, z: number): void => {
    positions.push(x, 0, z);
    normals.push(0, 1, 0);
    uvs.push(0, 0);
  };
  // Hand segments: the OSM path net aims at the old (misaligned) moat
  // crossing — these splice the approach INTO the drawbridge axis so the
  // ribbon, deck, and gate line up (deck: x 5.8, z −3..11, ≈5.4 m wide).
  const HAND_SEGMENTS: readonly (readonly [Pt, Pt])[] = [
    [[5.8, 24], [5.8, 10.5]], // hub-side approach → drawbridge south edge
    [[5.8, -2.5], [5.8, -24]], // gate threshold → corridor → Fantasyland
  ];
  const segments: (readonly [Pt, Pt])[] = [...HAND_SEGMENTS];
  for (const path of PARK_LAYOUT.paths) {
    if (path.kind !== "footway" && path.kind !== "pedestrian" && path.kind !== "steps") continue;
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      segments.push([a, b]);
    }
  }
  {
    for (const [a, b] of segments) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.3) continue;
      // Perpendicular half-width, slightly extended along the segment so
      // consecutive quads overlap at joints instead of leaving wedges.
      const ex = (dx / len) * 0.8;
      const ez = (dz / len) * 0.8;
      const nx = (dz / len) * HALF_WIDTH;
      const nz = -(dx / len) * HALF_WIDTH;
      const ax = a[0] - ex;
      const az = a[1] - ez;
      const bx = b[0] + ex;
      const bz = b[1] + ez;
      push(ax - nx, az - nz);
      push(bx - nx, bz - nz);
      push(bx + nx, bz + nz);
      push(ax - nx, az - nz);
      push(bx + nx, bz + nz);
      push(ax + nx, az + nz);
    }
  }
  if (positions.length === 0) return;
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  const mesh = new Mesh(
    geo,
    new MeshStandardMaterial({ color: 0xd8cab0, roughness: 0.95 }),
  );
  mesh.position.y = 0.1; // above greens, below water/decks
  mesh.receiveShadow = true;
  scene.add(mesh);
}
