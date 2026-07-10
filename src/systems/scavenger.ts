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
import { STARS } from "../config/scavenger";
import { Emitter } from "./events";

const STORAGE_KEY = "dlv-scavenger-progress";
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

interface ScavengerEvents extends Record<string, unknown> {
  progress: { collected: number; total: number; clue: string | null; complete: boolean };
}

/**
 * Sequential golden-star hunt. Only the current target star exists in the
 * world; collecting it plays a synthesized chime + sparkle burst, advances
 * the sequence, and persists to localStorage.
 */
export class ScavengerSystem {
  readonly events = new Emitter<ScavengerEvents>();

  private readonly scene: Scene;
  private collected: number;
  private star: Mesh | null = null;
  private sparkles: { points: Points; life: number } | null = null;
  private time = 0;
  private celebration = 0; // seconds remaining
  private nextBurst = 0;
  private readonly bursts: Burst[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw !== null ? Number.parseInt(raw, 10) : 0;
    this.collected = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, STARS.length)) : 0;
    this.spawnCurrent();
  }

  get state(): { collected: number; total: number; clue: string | null; complete: boolean } {
    const next = STARS[this.collected];
    return {
      collected: this.collected,
      total: STARS.length,
      clue: next ? next.clue : null,
      complete: this.collected >= STARS.length,
    };
  }

  reset(): void {
    this.collected = 0;
    window.localStorage.setItem(STORAGE_KEY, "0");
    this.spawnCurrent();
    this.events.emit("progress", this.state);
  }

  update(dt: number, playerPosition: Vector3): void {
    this.time += dt;
    if (this.star) {
      this.star.rotation.y += dt * 1.6;
      const base = this.star.userData["baseY"] as number;
      this.star.position.y = base + Math.sin(this.time * 2.2) * 0.18;

      const d = playerPosition.distanceTo(this.star.position);
      if (d < COLLECT_RADIUS) this.collect();
    }
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

  private collect(): void {
    if (!this.star) return;
    const at = this.star.position.clone();
    this.scene.remove(this.star);
    this.star = null;

    this.collected = Math.min(this.collected + 1, STARS.length);
    window.localStorage.setItem(STORAGE_KEY, String(this.collected));
    this.burstSparkles(at);
    playChime();
    this.spawnCurrent();
    if (this.collected >= STARS.length) {
      this.celebration = CELEBRATION_SECONDS;
      this.nextBurst = 0;
    }
    this.events.emit("progress", this.state);
  }

  private spawnCurrent(): void {
    if (this.star) {
      this.scene.remove(this.star);
      this.star = null;
    }
    const def = STARS[this.collected];
    if (!def) return;

    const material = new MeshStandardMaterial({
      color: 0x8a6a20,
      emissive: new Color(0xffd24a),
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.55,
    });
    registerEmissive(material, 2.6, 0.9);
    const mesh = new Mesh(starGeometry(), material);
    mesh.position.set(def.position[0], def.position[1], def.position[2]);
    mesh.userData["baseY"] = def.position[1];
    mesh.castShadow = true;
    this.star = mesh;
    this.scene.add(mesh);
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

/** Flat 5-point star, extruded. */
function starGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  const outer = 0.5;
  const inner = 0.21;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
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
