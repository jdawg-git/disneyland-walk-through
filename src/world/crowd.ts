import {
  CapsuleGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { MAX_NPCS } from "../config/crowds";
import { landAt } from "../config/lands";
import { PARK_LAYOUT, type Pt } from "../data/parkLayout";
import { mulberry32, type Rng } from "../engine/random";

const WAYPOINT_SPACING = 9; // meters between candidate waypoints on paths
const NEIGHBOR_RADIUS = 55; // how far an NPC roams for its next target

interface Npc {
  x: number;
  z: number;
  tx: number;
  tz: number;
  speed: number;
  phase: number;
}

/**
 * Ambient pedestrian crowd: one instanced capsule body + sphere head pair,
 * wandering between waypoints sampled from the real OSM walkways. Density
 * is driven by the crowd model (date + hour). NPCs are ambiance — no
 * collision, soft waypoint-following only.
 */
export class CrowdSystem {
  private readonly bodies: InstancedMesh;
  private readonly heads: InstancedMesh;
  private readonly npcs: Npc[] = [];
  private readonly waypoints: readonly Pt[];
  private readonly rng: Rng;
  private active = 0;
  private time = 0;

  constructor(scene: Scene, seed: number) {
    this.rng = mulberry32(seed + 101);
    this.waypoints = buildWaypoints();

    const bodyMaterial = new MeshStandardMaterial({ roughness: 0.9 });
    this.bodies = new InstancedMesh(new CapsuleGeometry(0.26, 0.85, 2, 7), bodyMaterial, MAX_NPCS);
    const headMaterial = new MeshStandardMaterial({ color: 0xe8c49a, roughness: 0.8 });
    this.heads = new InstancedMesh(new SphereGeometry(0.15, 7, 6), headMaterial, MAX_NPCS);

    const palette = [
      0xc75b4a, 0x4a7ec7, 0x58a86a, 0xd9a545, 0x9a6fc0, 0x50a8b8, 0xd97b9d, 0x8a8f98,
      0xead080, 0x6a8fd0,
    ];
    const color = new Color();
    for (let i = 0; i < MAX_NPCS; i++) {
      color.setHex(palette[Math.floor(this.rng() * palette.length)] ?? 0x8a8f98);
      this.bodies.setColorAt(i, color);
      const wp = this.waypoints[Math.floor(this.rng() * this.waypoints.length)] ?? [0, 150];
      const npc: Npc = {
        x: wp[0] + (this.rng() - 0.5) * 4,
        z: wp[1] + (this.rng() - 0.5) * 4,
        tx: wp[0],
        tz: wp[1],
        speed: 0.7 + this.rng() * 0.8,
        phase: this.rng() * Math.PI * 2,
      };
      this.retarget(npc);
      this.npcs.push(npc);
    }
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;

    this.bodies.castShadow = true;
    scene.add(this.bodies, this.heads);
    this.setCount(0);
  }

  /** Show exactly `count` NPCs (instances beyond it are hidden). */
  setCount(count: number): void {
    this.active = Math.max(0, Math.min(MAX_NPCS, count));
    this.bodies.count = this.active;
    this.heads.count = this.active;
  }

  update(dt: number): void {
    this.time += dt;
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const pos = new Vector3();
    const one = new Vector3(1, 1, 1);

    for (let i = 0; i < this.active; i++) {
      const npc = this.npcs[i];
      if (!npc) continue;
      const dx = npc.tx - npc.x;
      const dz = npc.tz - npc.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        this.retarget(npc);
      } else {
        npc.x += (dx / dist) * npc.speed * dt;
        npc.z += (dz / dist) * npc.speed * dt;
      }

      const bob = Math.sin(this.time * 7 + npc.phase) * 0.045;
      const yaw = Math.atan2(dx, dz);
      q.setFromAxisAngle(up, yaw);
      pos.set(npc.x, 0.9 + bob, npc.z);
      m.compose(pos, q, one);
      this.bodies.setMatrixAt(i, m);
      pos.set(npc.x, 1.72 + bob, npc.z);
      m.compose(pos, q, one);
      this.heads.setMatrixAt(i, m);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }

  private retarget(npc: Npc): void {
    // Pick a waypoint near the current position; fall back to anywhere.
    for (let tries = 0; tries < 8; tries++) {
      const wp = this.waypoints[Math.floor(this.rng() * this.waypoints.length)];
      if (!wp) continue;
      const d = Math.hypot(wp[0] - npc.x, wp[1] - npc.z);
      if (d > 4 && d < NEIGHBOR_RADIUS) {
        npc.tx = wp[0] + (this.rng() - 0.5) * 5;
        npc.tz = wp[1] + (this.rng() - 0.5) * 5;
        return;
      }
    }
    const wp = this.waypoints[Math.floor(this.rng() * this.waypoints.length)] ?? [0, 150];
    npc.tx = wp[0];
    npc.tz = wp[1];
  }
}

/**
 * Waypoints sampled along real walkways inside guest lands. High-traffic
 * lands (Main Street, hub, Fantasyland) get duplicated entries so the crowd
 * concentrates where real crowds do; attraction entrances get milling
 * clusters.
 */
function buildWaypoints(): Pt[] {
  const weightByLand: Record<string, number> = {
    mainStreet: 4,
    hub: 4,
    fantasyland: 2,
    tomorrowland: 2,
    neworleans: 2,
  };
  const points: Pt[] = [];
  for (const path of PARK_LAYOUT.paths) {
    if (path.kind !== "footway" && path.kind !== "pedestrian") continue;
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i];
      const b = path.points[i + 1];
      if (!a || !b) continue;
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 0; d < segLen; d += WAYPOINT_SPACING) {
        const t = d / segLen;
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        const land = landAt(x, z);
        if (!land) continue;
        const weight = weightByLand[land.id] ?? 1;
        for (let w = 0; w < weight; w++) points.push([x, z]);
      }
    }
  }
  // Milling clusters near attraction entrances.
  for (const attraction of PARK_LAYOUT.attractions) {
    const [x, z] = attraction.center;
    if (landAt(x, z) === null) continue;
    points.push([x, z], [x + 4, z], [x, z + 4]);
  }
  return points;
}
