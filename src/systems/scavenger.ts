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
