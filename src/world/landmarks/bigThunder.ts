import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  TorusGeometry,
  Vector2,
} from "three";
import { createNoise2D } from "../../engine/noise";

/**
 * Big Thunder Mountain v3 — true HOODOOS, not a pointy peak: tapering
 * craggy rock spires (Bryce-Canyon style) with flared talus bases,
 * terraced strata ledges, and squared-off ANVIL caprocks with flat mesa
 * tops — clustered tight on one broad terraced base mound so they read
 * as a single jagged massif. Strata bands
 * (rust / orange / cream) paint every surface as vertex colors; a timber
 * mine headframe and trestle sell "the wildest ride in the wilderness".
 *
 * Collider contract: ONE circle r 30 at the anchor in walkable.ts (the
 * base mound footprint contains every finger).
 */

const STRATA: readonly Color[] = [
  new Color(0x9c5636), // dark rust
  new Color(0xb4643c), // rust
  new Color(0xc8825a), // orange
  new Color(0xd9a878), // pale tan
  new Color(0xb4643c), // rust again
  new Color(0xc08050), // sandy orange
];

/** [dx, dz, shaft radius, height] — tallest finger center-back, bases
 * overlapping so the cluster reads as ONE jagged massif with summits. */
const FINGERS: readonly (readonly [number, number, number, number])[] = [
  [0, -2, 5.2, 30],
  [-6, 4, 4.2, 24],
  [6, -7, 4.4, 26],
  [9, 4, 3.6, 18],
  [-10, -5, 3.8, 21],
  [-12, 9, 3.2, 15],
  [13, -1, 3.2, 16],
  [3, 8, 3.0, 13],
];

const BASE_RADIUS = 30;
const BASE_HEIGHT = 7;

/**
 * Hoodoo silhouette: broad talus, an upward-TAPERING craggy shaft, then a
 * squared-off ANVIL caprock with a flat mesa top. Deliberately angular —
 * a rounded bulge with a domed tip reads as something else entirely.
 */
function hoodooProfile(radius: number, height: number): Vector2[] {
  const p = (r: number, t: number): Vector2 => new Vector2(radius * r, height * t);
  return [
    p(1.5, 0),
    p(1.15, 0.12),
    p(1.0, 0.28),
    p(0.86, 0.5),
    p(0.78, 0.68), // shaft tapers all the way up — spire, not column
    p(0.74, 0.74),
    p(1.08, 0.755), // caprock: hard step OUT (overhanging slab edge)
    p(1.1, 0.88), // near-vertical slab side
    p(0.98, 0.9),
    p(0.6, 0.93), // flat, angular top — no dome
    new Vector2(0.05, height * 0.94),
  ];
}

export function buildBigThunder(scene: Scene, x: number, z: number): void {
  const noise = createNoise2D(266074156);
  const group = new Group();

  const rockMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
  });

  /** fbm crag + strata vertex colors over any radial geometry. */
  const sculpt = (
    geo: LatheGeometry | ConeGeometry,
    height: number,
    yOffset: number,
    seedShift: number,
    cragAmp: number,
  ): void => {
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r < 0.05) continue;
      const t = (vy - yOffset) / height;
      const theta = Math.atan2(vz, vx);
      const crag =
        noise.fbm(Math.cos(theta) * 1.8 + seedShift * 13, Math.sin(theta) * 1.8 + t * 4.5 + seedShift * 7, 3) *
        cragAmp;
      // Stepped ledges: triangle wave over height terraces the rock.
      const tri = Math.abs(((t * 6) % 1) - 0.5) * 2;
      const terrace = (tri - 0.5) * 0.09;
      const damp = Math.min(1, t * 8 + 0.25) * Math.min(1, (1 - t) * 5 + 0.15);
      const mult = 1 + (crag + terrace) * damp;
      pos.setX(i, vx * mult);
      pos.setZ(i, vz * mult);
    }
    geo.computeVertexNormals();

    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, (pos.getY(i) - yOffset) / height));
      const theta = Math.atan2(pos.getZ(i), pos.getX(i));
      const waver = noise.sample(Math.cos(theta) * 3 + 90, Math.sin(theta) * 3 + 90) * 0.06;
      const band = Math.max(0, Math.min(STRATA.length - 1, Math.floor((t + waver) * STRATA.length)));
      c.copy(STRATA[band] ?? STRATA[1]!);
      const shade = 0.92 + noise.sample(theta * 5 + 120, t * 11) * 0.08;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
  };

  // Broad terraced base mound the fingers grow from.
  const base = new ConeGeometry(BASE_RADIUS, BASE_HEIGHT, 24, 6);
  sculpt(base, BASE_HEIGHT, -BASE_HEIGHT / 2, 99, 0.16);
  const baseMesh = new Mesh(base, rockMaterial);
  baseMesh.position.y = BASE_HEIGHT / 2;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Hoodoo fingers: tapered lathe spires under flat anvil caprocks.
  FINGERS.forEach(([dx, dz, radius, height], i) => {
    const geo = new LatheGeometry(hoodooProfile(radius, height), 12);
    sculpt(geo, height, 0, i, 0.13);
    const finger = new Mesh(geo, rockMaterial);
    finger.position.set(dx, 0.5, dz); // root slightly sunk into the mound
    finger.rotation.x = Math.sin(i * 4.7) * 0.05;
    finger.rotation.z = Math.cos(i * 3.1) * 0.05;
    finger.castShadow = true;
    finger.receiveShadow = true;
    group.add(finger);
  });

  buildMineProps(group);

  group.position.set(x, 0, z);
  scene.add(group);
}

/** Timber headframe + short trestle — dark mining silhouettes. */
function buildMineProps(group: Group): void {
  const wood = new MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const iron = new MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.7 });

  // Headframe at the mound's edge (A-frame legs, crossbeam, wheel).
  const frame = new Group();
  for (const side of [-1, 1]) {
    const leg = new Mesh(new BoxGeometry(0.5, 11, 0.5), wood);
    leg.position.set(side * 2.2, 5.5, 0);
    leg.rotation.z = side * -0.18;
    leg.castShadow = true;
    frame.add(leg);
    const backLeg = new Mesh(new BoxGeometry(0.4, 9, 0.4), wood);
    backLeg.position.set(side * 1.6, 4.5, -2.4);
    backLeg.rotation.x = 0.28;
    backLeg.rotation.z = side * -0.14;
    frame.add(backLeg);
  }
  const crossbeam = new Mesh(new BoxGeometry(4.4, 0.5, 0.6), wood);
  crossbeam.position.y = 10.6;
  frame.add(crossbeam);
  const wheel = new Mesh(new TorusGeometry(1.1, 0.14, 6, 14), iron);
  wheel.position.y = 11.6;
  frame.add(wheel);
  frame.position.set(24, 0, 14);
  frame.rotation.y = 0.6;
  group.add(frame);

  // Short trestle skirting the mound's south face.
  const trestle = new Group();
  for (let i = 0; i < 4; i++) {
    const post = new Mesh(new BoxGeometry(0.45, 5.2, 0.45), wood);
    post.position.set(i * 3.2, 2.6, 0);
    post.castShadow = true;
    trestle.add(post);
    const brace = new Mesh(new BoxGeometry(0.3, 4.4, 0.3), wood);
    brace.position.set(i * 3.2 + 1.4, 2.4, 0);
    brace.rotation.z = 0.62;
    trestle.add(brace);
  }
  const deck = new Mesh(new BoxGeometry(11.5, 0.4, 1.6), wood);
  deck.position.set(4.8, 5.3, 0);
  trestle.add(deck);
  const rails = new Mesh(new BoxGeometry(11.5, 0.1, 1.1), iron);
  rails.position.set(4.8, 5.6, 0);
  trestle.add(rails);
  trestle.position.set(8, 0, -26);
  trestle.rotation.y = -0.8;
  group.add(trestle);
}
