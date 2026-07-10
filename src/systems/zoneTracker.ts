import type { Vector3 } from "three";
import { landAt, type LandDef } from "../config/lands";
import { Emitter } from "./events";

interface ZoneEvents extends Record<string, unknown> {
  landChange: { land: LandDef | null };
}

/**
 * Tracks which land polygon the player is in (point-in-polygon over the
 * authored lands). Single source of truth for audio zones, the HUD label,
 * and guide context. Checks a few times a second — no need for per-frame.
 */
export class ZoneTracker {
  readonly events = new Emitter<ZoneEvents>();

  private current: LandDef | null = null;
  private accumulator = 0;

  get land(): LandDef | null {
    return this.current;
  }

  update(dt: number, position: Vector3): void {
    this.accumulator += dt;
    if (this.accumulator < 0.25) return;
    this.accumulator = 0;

    const land = landAt(position.x, position.z);
    if (land?.id !== this.current?.id) {
      this.current = land;
      this.events.emit("landChange", { land });
    }
  }
}
