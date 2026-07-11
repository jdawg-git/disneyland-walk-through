import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { registerUpdatable } from "../engine/updatables";
import { PARK_LAYOUT, pointInPolygon } from "../data/parkLayout";

const BOAT_SPEED = 2.2; // m/s — stately paddle-wheeler pace

/**
 * The Mark Twain-style riverboat: white triple-decker with twin stacks and
 * a turning red stern paddle wheel, circling Tom Sawyer Island on the
 * Rivers of America. The loop spline is derived from the data: for each
 * bearing from the island's center, the boat track sits midway between the
 * island shore and the river's outer bank.
 */
export function buildSteamboat(scene: Scene): void {
  const river = PARK_LAYOUT.water.find((w) => w.name === "Rivers of America");
  const island = river?.inner?.[0];
  if (!river || !island || island.length < 8) return;

  // Channel midline: walk the island ring in order; at every Nth vertex,
  // march outward along the local edge normal until leaving the water
  // (the far bank), then place the track point midway across the channel.
  // Ring order keeps the loop continuous even though the channel width
  // varies wildly (the island nearly touches the bank in places).
  const points: Vector3[] = [];
  const STEP = 1.5;
  const MAX_MARCH = 60;
  for (let i = 0; i < island.length; i += 3) {
    const p = island[i];
    const prev = island[(i - 3 + island.length) % island.length];
    const next = island[(i + 3) % island.length];
    if (!p || !prev || !next) continue;
    // Outward normal from the local tangent (test both directions).
    const tx = next[0] - prev[0];
    const tz = next[1] - prev[1];
    const tLen = Math.hypot(tx, tz);
    if (tLen < 0.1) continue;
    let nx = tz / tLen;
    let nz = -tx / tLen;
    if (pointInPolygon(p[0] + nx * 1.2, p[1] + nz * 1.2, island)) {
      nx = -nx;
      nz = -nz;
    }
    // March to the far bank.
    let bank = 0;
    for (let d = STEP; d <= MAX_MARCH; d += STEP) {
      const x = p[0] + nx * d;
      const z = p[1] + nz * d;
      if (!pointInPolygon(x, z, river.outer) || pointInPolygon(x, z, island)) break;
      bank = d;
    }
    if (bank < 6) continue; // channel too narrow here — skip
    const mid = bank / 2;
    const candidate = new Vector3(p[0] + nx * mid, 0.1, p[1] + nz * mid);
    // No near-duplicate consecutive points — zero-length curve segments
    // NaN-poison three's arc-length reparameterization.
    const last = points[points.length - 1];
    if (last && last.distanceTo(candidate) < 2) continue;
    points.push(candidate);
  }
  if (points.length < 12) return;
  const curve = new CatmullRomCurve3(points, true, "catmullrom", 0.3);
  const loopLength = curve.getLength();
  if (!Number.isFinite(loopLength) || loopLength < 50) return;

  // --- The boat (built facing +Z) ---
  const boat = new Group();
  const white = new MeshStandardMaterial({
    color: 0xf4f2ea,
    roughness: 0.85,
    emissive: new Color(0xcfd4ff),
    emissiveIntensity: 0,
  });
  registerEmissive(white, 0.3);
  const dark = new MeshStandardMaterial({ color: 0x26221e, roughness: 0.7 });
  const redMaterial = new MeshStandardMaterial({ color: 0xa03028, roughness: 0.7 });

  const hull = new Mesh(new BoxGeometry(4.6, 1.2, 12), white);
  hull.position.y = 0.7;
  boat.add(hull);
  const deck2 = new Mesh(new BoxGeometry(4.0, 1.1, 9.5), white);
  deck2.position.y = 1.85;
  boat.add(deck2);
  const deck3 = new Mesh(new BoxGeometry(3.4, 1.0, 7), white);
  deck3.position.y = 2.9;
  boat.add(deck3);
  const pilothouse = new Mesh(new BoxGeometry(2.0, 1.1, 2.2), white);
  pilothouse.position.set(0, 3.95, 1.6);
  boat.add(pilothouse);
  for (const sx of [-1.1, 1.1]) {
    const funnel = new Mesh(new CylinderGeometry(0.32, 0.4, 2.6, 10), dark);
    funnel.position.set(sx, 4.6, 3.4);
    boat.add(funnel);
  }
  // Stern paddle wheel (axis across the beam), spun by the updatable.
  const wheel = new Group();
  const drum = new Mesh(new CylinderGeometry(1.15, 1.15, 3.6, 10), redMaterial);
  drum.rotation.z = Math.PI / 2;
  wheel.add(drum);
  for (let i = 0; i < 8; i++) {
    const paddle = new Mesh(new BoxGeometry(3.7, 0.16, 0.7), redMaterial);
    paddle.rotation.x = (i / 8) * Math.PI * 2;
    wheel.add(paddle);
  }
  wheel.position.set(0, 1.1, -6.4);
  boat.add(wheel);

  boat.castShadow = true;
  scene.add(boat);

  // --- Loop driver with gentle bob ---
  let distance = 0;
  const ahead = new Vector3();
  registerUpdatable((dt, time) => {
    // Safe modulo: distance must never go negative (negative u sends
    // three's arc-length search out of bounds).
    distance = (((distance + BOAT_SPEED * dt) % loopLength) + loopLength) % loopLength;
    const u = distance / loopLength;
    curve.getPointAt(u, boat.position);
    curve.getPointAt((u + 3 / loopLength) % 1, ahead);
    boat.lookAt(ahead);
    boat.position.y = 0.1 + Math.sin(time * 0.9) * 0.06;
    wheel.rotation.x += dt * 1.8;
  });
}
