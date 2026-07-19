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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAX_NPCS } from "../config/crowds";
import { landAt } from "../config/lands";
import { PARK_LAYOUT, type Pt } from "../data/parkLayout";
import { mulberry32, type Rng } from "../engine/random";

const WAYPOINT_SPACING = 9; // meters between candidate waypoints on paths
const NEIGHBOR_RADIUS = 55; // how far a group roams for its next target
const EARS_RATE = 0.4; // 2 in 5 guests wear Mickey ears

// Guest sizes: [scale, weight]. Children small, teens mid, adults full.
const SIZES: readonly (readonly [number, number])[] = [
  [1.0, 0.6], // adult
  [0.82, 0.2], // teen
  [0.58, 0.2], // child
];

interface Npc {
  x: number;
  z: number;
  tx: number;
  tz: number;
  speed: number;
  phase: number;
  scale: number;
  /** Index of the group leader, or -1 if this NPC leads (or walks alone). */
  leader: number;
  /** Personal offset from the leader (formation within the group). */
  ox: number;
  oz: number;
}

/**
 * Ambient pedestrian crowd: instanced capsule bodies + heads (+ Mickey ears
 * for 1 in 10), wandering between waypoints sampled from the real OSM
 * walkways. Guests travel in groups of 1-4 that stay together, in three
 * sizes (adults, teens, children). Ambiance only — no collision.
 */
export class CrowdSystem {
  private readonly bodies: InstancedMesh;
  private readonly heads: InstancedMesh;
  private readonly ears: InstancedMesh;
  private readonly earOwners: number[] = []; // ear slot → npc index
  private readonly npcs: Npc[] = [];
  private readonly waypoints: readonly Pt[];
  private readonly rng: Rng;
  /** O(1) walkable-bitmap probe; null = unconstrained (tests). */
  private readonly walkable: ((x: number, z: number) => boolean) | null;
  private active = 0;
  private time = 0;

  constructor(scene: Scene, seed: number, walkable?: (x: number, z: number) => boolean) {
    this.rng = mulberry32(seed + 101);
    this.walkable = walkable ?? null;
    // Reject waypoints on blocked cells (buildings/water) so groups never
    // AIM at somewhere illegal; keep the raw list if filtering would gut it.
    const all = buildWaypoints();
    const open = walkable ? all.filter((w) => walkable(w[0], w[1])) : all;
    this.waypoints = open.length > 50 ? open : all;

    const bodyMaterial = new MeshStandardMaterial({ roughness: 0.9 });
    this.bodies = new InstancedMesh(new CapsuleGeometry(0.26, 0.85, 2, 7), bodyMaterial, MAX_NPCS);
    const headMaterial = new MeshStandardMaterial({ color: 0xe8c49a, roughness: 0.8 });
    this.heads = new InstancedMesh(new SphereGeometry(0.15, 7, 6), headMaterial, MAX_NPCS);

    // Mickey ears: two little spheres, one merged geometry per eared guest.
    const earL = new SphereGeometry(0.088, 7, 6);
    earL.translate(-0.135, 0.1, 0);
    const earR = new SphereGeometry(0.088, 7, 6);
    earR.translate(0.135, 0.1, 0);
    const earGeometry = mergeGeometries([earL, earR]) ?? earL;
    const earMaterial = new MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    this.ears = new InstancedMesh(earGeometry, earMaterial, Math.ceil(MAX_NPCS * EARS_RATE * 1.5));

    const palette = [
      0xc75b4a, 0x4a7ec7, 0x58a86a, 0xd9a545, 0x9a6fc0, 0x50a8b8, 0xd97b9d, 0x8a8f98,
      0xead080, 0x6a8fd0,
    ];
    const color = new Color();

    // Build guests in groups of 1-4 spawned around a shared waypoint.
    let i = 0;
    while (i < MAX_NPCS) {
      const groupSize = Math.min(1 + Math.floor(this.rng() * 4), MAX_NPCS - i);
      const wp = this.waypoints[Math.floor(this.rng() * this.waypoints.length)] ?? [0, 150];
      const leaderIndex = i;
      const groupSpeed = 0.7 + this.rng() * 0.8;
      for (let m = 0; m < groupSize; m++) {
        const isLeader = m === 0;
        const ox = isLeader ? 0 : (this.rng() - 0.5) * 2.6;
        const oz = isLeader ? 0 : (this.rng() - 0.5) * 2.6;
        const npc: Npc = {
          x: wp[0] + ox + (this.rng() - 0.5) * 2,
          z: wp[1] + oz + (this.rng() - 0.5) * 2,
          tx: wp[0] + ox,
          tz: wp[1] + oz,
          speed: groupSpeed * (isLeader ? 1 : 1.05), // followers keep up
          phase: this.rng() * Math.PI * 2,
          scale: this.pickScale(),
          leader: isLeader ? -1 : leaderIndex,
          ox,
          oz,
        };
        color.setHex(palette[Math.floor(this.rng() * palette.length)] ?? 0x8a8f98);
        this.bodies.setColorAt(i, color);
        if (this.rng() < EARS_RATE && this.earOwners.length < this.ears.count) {
          this.earOwners.push(i);
        }
        this.npcs.push(npc);
        i += 1;
      }
      const leaderNpc = this.npcs[leaderIndex];
      if (leaderNpc) this.retarget(leaderNpc);
    }
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;

    this.bodies.castShadow = true;
    scene.add(this.bodies, this.heads, this.ears);
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
    const scl = new Vector3();

    for (let i = 0; i < this.active; i++) {
      const npc = this.npcs[i];
      if (!npc) continue;

      // Followers glue their target to the leader's position + offset.
      if (npc.leader >= 0) {
        const leader = this.npcs[npc.leader];
        if (leader) {
          npc.tx = leader.x + npc.ox;
          npc.tz = leader.z + npc.oz;
        }
      }

      const dx = npc.tx - npc.x;
      const dz = npc.tz - npc.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        if (npc.leader < 0) this.retarget(npc);
      } else {
        // NPCs obey the same walkable grid as the player: no wading the
        // rivers, no ghosting through shop walls. Blocked leaders pick a
        // new destination; blocked followers wait for the leader to move
        // (their glue-to-leader targeting self-corrects).
        const stepX = npc.x + (dx / dist) * npc.speed * dt;
        const stepZ = npc.z + (dz / dist) * npc.speed * dt;
        if (!this.walkable || this.walkable(stepX, stepZ)) {
          npc.x = stepX;
          npc.z = stepZ;
        } else if (npc.leader < 0) {
          this.retarget(npc);
        }
      }

      const s = npc.scale;
      const bob = Math.sin(this.time * 7 + npc.phase) * 0.045 * s;
      const yaw = Math.atan2(dx, dz);
      q.setFromAxisAngle(up, yaw);
      scl.setScalar(s);
      pos.set(npc.x, 0.9 * s + bob, npc.z);
      m.compose(pos, q, scl);
      this.bodies.setMatrixAt(i, m);
      pos.set(npc.x, 1.72 * s + bob, npc.z);
      m.compose(pos, q, scl);
      this.heads.setMatrixAt(i, m);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;

    // Ears ride on their owners' heads; hide slots whose owner is inactive.
    for (let e = 0; e < this.earOwners.length; e++) {
      const owner = this.earOwners[e];
      const npc = owner !== undefined ? this.npcs[owner] : undefined;
      if (owner === undefined || npc === undefined || owner >= this.active) {
        m.makeScale(0, 0, 0);
        this.ears.setMatrixAt(e, m);
        continue;
      }
      const s = npc.scale;
      const bob = Math.sin(this.time * 7 + npc.phase) * 0.045 * s;
      const yaw = Math.atan2(npc.tx - npc.x, npc.tz - npc.z);
      q.setFromAxisAngle(up, yaw);
      scl.setScalar(s);
      pos.set(npc.x, 1.82 * s + bob, npc.z);
      m.compose(pos, q, scl);
      this.ears.setMatrixAt(e, m);
    }
    this.ears.count = this.earOwners.length;
    this.ears.instanceMatrix.needsUpdate = true;
  }

  private pickScale(): number {
    const roll = this.rng();
    let acc = 0;
    for (const [scale, weight] of SIZES) {
      acc += weight;
      if (roll < acc) return scale + (this.rng() - 0.5) * 0.08;
    }
    return 1.0;
  }

  private retarget(npc: Npc): void {
    // Pick a waypoint near the current position; fall back to anywhere.
    for (let tries = 0; tries < 8; tries++) {
      const wp = this.waypoints[Math.floor(this.rng() * this.waypoints.length)];
      if (!wp) continue;
      const d = Math.hypot(wp[0] - npc.x, wp[1] - npc.z);
      if (d > 4 && d < NEIGHBOR_RADIUS) {
        const jx = wp[0] + (this.rng() - 0.5) * 5;
        const jz = wp[1] + (this.rng() - 0.5) * 5;
        if (this.walkable && !this.walkable(jx, jz)) {
          npc.tx = wp[0];
          npc.tz = wp[1];
        } else {
          npc.tx = jx;
          npc.tz = jz;
        }
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
