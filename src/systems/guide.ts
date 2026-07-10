import type { LandDef } from "../config/lands";
import type { TimeOfDay } from "../engine/dayNight";

export interface GuideContext {
  readonly land: LandDef | null;
  readonly position: { readonly x: number; readonly z: number };
  readonly timeOfDay: TimeOfDay;
  readonly scavenger: { readonly collected: number; readonly total: number };
}

export const GUIDE_MISSING_KEY_MESSAGE =
  "Hi there! I'm your park guide — but my magic connection isn't set up yet. " +
  "Add your Gemini key to a .env file (see .env.example) and restart the dev " +
  "server to bring me to life.";

/**
 * Tour-guide chat. Stage 2 ships the offline stub path (missing-key message
 * + canned local answers); stage 7 adds the live Gemini call with full park
 * context (landmark bearings, crowd level, hunt progress).
 */
export class GuideSystem {
  private readonly apiKey: string;

  constructor() {
    const key: unknown = import.meta.env["VITE_GEMINI_API_KEY"];
    this.apiKey = typeof key === "string" ? key.trim() : "";
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  async ask(question: string, context: GuideContext): Promise<string> {
    if (!this.enabled) return GUIDE_MISSING_KEY_MESSAGE;
    // Stage 7 replaces this with the Gemini REST call.
    const where = context.land ? context.land.name : "the park";
    return (
      `(guide preview) You're in ${where} at ${context.timeOfDay}. ` +
      `Full Gemini answers arrive in a later build stage — you asked: "${question}"`
    );
  }
}
