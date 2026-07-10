import {
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Scene,
  Vector3,
} from "three";
import { applyEmissiveBoost } from "./emissive";

export type TimeOfDay = "day" | "night";

interface LightingPreset {
  readonly skyColor: Color;
  readonly fogColor: Color;
  readonly fogDensity: number;
  readonly sunColor: Color;
  readonly sunIntensity: number;
  readonly sunPosition: Vector3;
  readonly hemiSky: Color;
  readonly hemiGround: Color;
  readonly hemiIntensity: number;
  readonly bloomIntensity: number;
  /** 0 = emissives off (day), 1 = full night glow. */
  readonly emissiveT: number;
}

const DAY: LightingPreset = {
  skyColor: new Color(0x8ec8ea),
  fogColor: new Color(0xbcd8e8),
  fogDensity: 0.0022,
  sunColor: new Color(0xfff2d8),
  sunIntensity: 2.6,
  sunPosition: new Vector3(180, 260, 120),
  hemiSky: new Color(0xbfdcf5),
  hemiGround: new Color(0x8a7f6a),
  hemiIntensity: 0.85,
  bloomIntensity: 0.25,
  emissiveT: 0,
};

const NIGHT: LightingPreset = {
  skyColor: new Color(0x101c42),
  fogColor: new Color(0x131f48),
  fogDensity: 0.0026,
  sunColor: new Color(0xa8bcec),
  sunIntensity: 0.55,
  sunPosition: new Vector3(-140, 220, -160),
  hemiSky: new Color(0x2a3c6e),
  hemiGround: new Color(0x1e1a30),
  hemiIntensity: 0.75,
  bloomIntensity: 1.05,
  emissiveT: 1,
};

const TRANSITION_SECONDS = 4;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * The park's entire lighting rig: one sun/moon directional, one hemisphere
 * light, exponential fog, sky color, plus bloom + emissive drive values.
 * Day/night is a single scalar blend across every preset field.
 */
export class DayNightSystem {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;

  private readonly scene: Scene;
  private readonly fog: FogExp2;
  private readonly sky = new Color();

  /** 0 = day, 1 = night. */
  private blend = 0;
  private target = 0;
  private onBloomChange: ((intensity: number) => void) | null = null;

  constructor(scene: Scene) {
    this.scene = scene;

    this.sun = new DirectionalLight(DAY.sunColor, DAY.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 900;
    const d = 260;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);

    this.hemi = new HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiIntensity);
    scene.add(this.hemi);

    this.fog = new FogExp2(DAY.fogColor.getHex(), DAY.fogDensity);
    scene.fog = this.fog;

    this.apply(0);
  }

  get timeOfDay(): TimeOfDay {
    return this.target >= 0.5 ? "night" : "day";
  }

  /** Register a callback used to push bloom intensity into the composer. */
  bindBloom(fn: (intensity: number) => void): void {
    this.onBloomChange = fn;
    fn(this.currentBloom());
  }

  setTime(time: TimeOfDay, instant = false): void {
    this.target = time === "night" ? 1 : 0;
    if (instant) {
      this.blend = this.target;
      this.apply(this.blend);
    }
  }

  toggle(): TimeOfDay {
    this.setTime(this.timeOfDay === "day" ? "night" : "day");
    return this.timeOfDay;
  }

  update(dt: number): void {
    if (this.blend === this.target) return;
    const step = dt / TRANSITION_SECONDS;
    this.blend =
      this.blend < this.target
        ? Math.min(this.target, this.blend + step)
        : Math.max(this.target, this.blend - step);
    this.apply(this.blend);
  }

  private currentBloom(): number {
    const t = smoothstep(this.blend);
    return DAY.bloomIntensity + (NIGHT.bloomIntensity - DAY.bloomIntensity) * t;
  }

  private apply(rawT: number): void {
    const t = smoothstep(rawT);

    this.sky.copy(DAY.skyColor).lerp(NIGHT.skyColor, t);
    this.scene.background = this.sky;
    this.fog.color.copy(DAY.fogColor).lerp(NIGHT.fogColor, t);
    this.fog.density = DAY.fogDensity + (NIGHT.fogDensity - DAY.fogDensity) * t;

    this.sun.color.copy(DAY.sunColor).lerp(NIGHT.sunColor, t);
    this.sun.intensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * t;
    this.sun.position.lerpVectors(DAY.sunPosition, NIGHT.sunPosition, t);

    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t);
    this.hemi.intensity = DAY.hemiIntensity + (NIGHT.hemiIntensity - DAY.hemiIntensity) * t;

    applyEmissiveBoost(t);
    this.onBloomChange?.(this.currentBloom());
  }
}
