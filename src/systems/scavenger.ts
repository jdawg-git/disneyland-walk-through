import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Scene,
  Shape,
  Vector3,
} from "three";
import { registerEmissive } from "../engine/emissive";
import { STARS, type StarDef } from "../config/scavenger";
import { Emitter } from "./events";

const STORAGE_KEY = "dlv-scavenger-progress-v2";
const LEGACY_KEY = "dlv-scavenger-progress";
const COLLECT_RADIUS = 2.2;

// Fireworks celebration over the castle when the hunt completes.
const CASTLE_SKY: readonly [number, number, number] = [6, 55, -12];
const CELEBRATION_SECONDS = 26;
const BURST_INTERVAL = 1.1;
const BURST_PARTICLES = 130;
const FIREWORK_COLORS = [0xffd24a, 0xff6a9a, 0x7ab8ff, 0x9affc8, 0xffa85a, 0xd0a0ff];

interface Burst {
  readonly points: Points;
  readonly velocities: Float32Array;
  life: number;
}

interface Progress {
  readonly ids: readonly number[];
  readonly last: number;
}

interface ScavengerEvents extends Record<string, unknown> {
  progress: { collected: number; total: number; clue: string | null; complete: boolean };
}

/**
 * Free-order golden-star hunt: ALL uncollected stars exist in the world and
 * any can be collected at any time. The HUD clue is a suggestion — it points
 * at the next uncollected star in numerical order after the one you most
 * recently found (wrapping around). Progress persists to localStorage.
 */
export class ScavengerSystem {
  readonly events = new Emitter<ScavengerEvents>();

  private readonly scene: Scene;
  private readonly stars = new Map<number, Mesh>();
  private readonly starMaterial: MeshStandardMaterial;
  private collected: Set<number>;
  private last = 0;
  private sparkles: { points: Points; life: number } | null = null;
  private time = 0;
  private celebration = 0; // seconds remaining
  private nextBurst = 0;
  private readonly bursts: Burst[] = [];

  constructor(scene: Scene) {
    this.scene = scene;

    const progress = loadProgress();
    this.collected = new Set(progress.ids.filter((id) => STARS.some((s) => s.id === id)));
    this.last = progress.last;

    this.starMaterial = new MeshStandardMaterial({
      color: 0x8a6a20,
      emissive: new Color(0xffd24a),
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.55,
    });
    registerEmissive(this.starMaterial, 2.6, 0.9);

    for (const def of STARS) {
      if (!this.collected.has(def.id)) this.spawnStar(def);
    }
  }

  get state(): { collected: number; total: number; clue: string | null; complete: boolean } {
    const next = this.nextSuggested();
    return {
      collected: this.collected.size,
      total: STARS.length,
      clue: next ? next.clue : null,
      complete: this.collected.size >= STARS.length,
    };
  }

  reset(): void {
    this.collected = new Set();
    this.last = 0;
    this.persist();
    for (const def of STARS) {
      if (!this.stars.has(def.id)) this.spawnStar(def);
    }
    this.events.emit("progress", this.state);
  }

  update(dt: number, playerPosition: Vector3): void {
    this.time += dt;
    let collectedId: number | null = null;
    for (const [id, mesh] of this.stars) {
      mesh.rotation.y += dt * 1.6;
      const base = mesh.userData["baseY"] as number;
      const phase = mesh.userData["phase"] as number;
      mesh.position.y = base + Math.sin(this.time * 2.2 + phase) * 0.18;
      if (collectedId === null && playerPosition.distanceTo(mesh.position) < COLLECT_RADIUS) {
        collectedId = id;
      }
    }
    if (collectedId !== null) this.collect(collectedId);

    if (this.sparkles) {
      this.sparkles.life -= dt;
      const material = this.sparkles.points.material as PointsMaterial;
      material.opacity = Math.max(0, this.sparkles.life / 1.4);
      this.sparkles.points.position.y += dt * 0.8;
      if (this.sparkles.life <= 0) {
        this.scene.remove(this.sparkles.points);
        this.sparkles = null;
      }
    }
    this.updateFireworks(dt);
  }

  /** Next uncollected star in numerical order after `last`, wrapping. */
  private nextSuggested(): StarDef | null {
    if (this.collected.size >= STARS.length) return null;
    const remaining = STARS.filter((s) => !this.collected.has(s.id)).sort((a, b) => a.id - b.id);
    return remaining.find((s) => s.id > this.last) ?? remaining[0] ?? null;
  }

  private collect(id: number): void {
    const mesh = this.stars.get(id);
    if (!mesh) return;
    const at = mesh.position.clone();
    this.scene.remove(mesh);
    this.stars.delete(id);

    this.collected.add(id);
    this.last = id;
    this.persist();
    this.burstSparkles(at);
    playChime();
    if (this.collected.size >= STARS.length) {
      this.celebration = CELEBRATION_SECONDS;
      this.nextBurst = 0;
    }
    this.events.emit("progress", this.state);
  }

  private spawnStar(def: StarDef): void {
    const mesh = new Mesh(starGeometry(), this.starMaterial);
    mesh.position.set(def.position[0], def.position[1], def.position[2]);
    mesh.userData["baseY"] = def.position[1];
    mesh.userData["phase"] = def.id * 0.7;
    mesh.castShadow = true;
    this.stars.set(def.id, mesh);
    this.scene.add(mesh);
  }

  private persist(): void {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ids: [...this.collected], last: this.last }),
    );
  }

  private updateFireworks(dt: number): void {
    if (this.celebration > 0) {
      this.celebration -= dt;
      this.nextBurst -= dt;
      if (this.nextBurst <= 0) {
        this.launchBurst();
        this.nextBurst = BURST_INTERVAL * (0.7 + Math.random() * 0.6);
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      if (!burst) continue;
      burst.life -= dt;
      const positions = burst.points.geometry.getAttribute("position");
      for (let p = 0; p < positions.count; p++) {
        positions.setXYZ(
          p,
          positions.getX(p) + burst.velocities[p * 3]! * dt,
          positions.getY(p) + burst.velocities[p * 3 + 1]! * dt,
          positions.getZ(p) + burst.velocities[p * 3 + 2]! * dt,
        );
        burst.velocities[p * 3 + 1]! -= 9 * dt; // gravity
      }
      positions.needsUpdate = true;
      const material = burst.points.material as PointsMaterial;
      material.opacity = Math.max(0, burst.life / 2.4);
      if (burst.life <= 0) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  private launchBurst(): void {
    const [cx, cy, cz] = CASTLE_SKY;
    const bx = cx + (Math.random() - 0.5) * 60;
    const by = cy + Math.random() * 30;
    const bz = cz + (Math.random() - 0.5) * 40;
    const positions = new Float32Array(BURST_PARTICLES * 3);
    const velocities = new Float32Array(BURST_PARTICLES * 3);
    for (let i = 0; i < BURST_PARTICLES; i++) {
      positions[i * 3] = bx;
      positions[i * 3 + 1] = by;
      positions[i * 3 + 2] = bz;
      // Uniform-ish sphere burst.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 7 + Math.random() * 9;
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const points = new Points(
      geometry,
      new PointsMaterial({
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)] ?? 0xffd24a,
        size: 0.55,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(points);
    this.bursts.push({ points, velocities, life: 2.4 });
  }

  private burstSparkles(at: Vector3): void {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.2;
      positions[i * 3] = at.x + Math.cos(a) * r;
      positions[i * 3 + 1] = at.y + (Math.random() - 0.3) * 1.4;
      positions[i * 3 + 2] = at.z + Math.sin(a) * r;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    const points = new Points(
      geometry,
      new PointsMaterial({
        color: 0xffe08a,
        size: 0.12,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(points);
    this.sparkles = { points, life: 1.4 };
  }
}

/** Load v2 progress; migrate legacy count-based progress (v1) if present. */
function loadProgress(): Progress {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as { ids?: unknown; last?: unknown };
      if (Array.isArray(parsed.ids)) {
        return {
          ids: parsed.ids.filter((n): n is number => typeof n === "number"),
          last: typeof parsed.last === "number" ? parsed.last : 0,
        };
      }
    } catch {
      // fall through to defaults
    }
  }
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    const count = Number.parseInt(legacy, 10);
    window.localStorage.removeItem(LEGACY_KEY);
    if (Number.isFinite(count) && count > 0) {
      const ids = STARS.slice(0, count).map((s) => s.id);
      return { ids, last: ids[ids.length - 1] ?? 0 };
    }
  }
  return { ids: [], last: 0 };
}

/** Flat 5-point star, extruded. */
function starGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  const outer = 0.5;
  const inner = 0.21;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Start the first OUTER point straight up (+90°) so the star stands on
    // two legs instead of balancing on one point (upside down).
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
}

/** Two-note synthesized chime — no audio asset needed. */
function playChime(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    gain.connect(ctx.destination);
    for (const [freq, delay] of [
      [1318.5, 0],
      [1760, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + 1.2);
    }
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Chime is decorative; ignore audio failures.
  }
}
