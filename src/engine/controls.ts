import { PerspectiveCamera, Vector3 } from "three";

export const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.5; // m/s — brisk theme-park pace
const SPRINT_SPEED = 10; // hold Shift to run
const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

/**
 * Pointer-lock first-person controls: WASD in camera-relative XZ, Shift to
 * sprint. Movement is resolved through a pluggable collision hook so the
 * walkable-grid system (stage 2) can slide the player along walls.
 */
export class FirstPersonControls {
  yaw = 0;
  pitch = 0;

  /** Given current + desired position, return the allowed position. */
  collide: (from: Vector3, to: Vector3) => Vector3 = (_from, to) => to;

  private readonly camera: PerspectiveCamera;
  private readonly keys = new Set<string>();
  private readonly desired = new Vector3();
  private locked = false;

  constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;

    domElement.ownerDocument.addEventListener("pointerlockchange", () => {
      this.locked = domElement.ownerDocument.pointerLockElement === domElement;
      if (!this.locked) this.keys.clear();
    });

    domElement.ownerDocument.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * LOOK_SENSITIVITY;
      this.pitch -= e.movementY * LOOK_SENSITIVITY;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    });

    domElement.ownerDocument.addEventListener("keydown", (e: KeyboardEvent) => {
      if (this.locked) this.keys.add(e.code);
    });
    domElement.ownerDocument.addEventListener("keyup", (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    });
  }

  get isLocked(): boolean {
    return this.locked;
  }

  update(dt: number): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    if (!this.locked) return;

    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    if (forward === 0 && strafe === 0) return;

    const speed =
      this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? SPRINT_SPEED : WALK_SPEED;
    const len = Math.hypot(forward, strafe);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Camera-relative movement on the ground plane (yaw only).
    const dx = ((strafe * cos - forward * sin) / len) * speed * dt;
    const dz = ((-forward * cos - strafe * sin) / len) * speed * dt;

    this.desired.set(this.camera.position.x + dx, EYE_HEIGHT, this.camera.position.z + dz);
    const allowed = this.collide(this.camera.position, this.desired);
    this.camera.position.copy(allowed);
    this.camera.position.y = EYE_HEIGHT;
  }
}
