import { renderContext, type GuideSnapshot } from "./guideContext";

export type GuideContext = GuideSnapshot;

export const GUIDE_MISSING_KEY_MESSAGE =
  "Hi there! I'm your park guide — but my magic connection isn't set up yet. " +
  "Add your Gemini key to a .env file (see .env.example) and restart the dev " +
  "server to bring me to life.";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PERSONA = `You are "Star", a warm, knowledgeable Disneyland tour guide inside a stylized
virtual recreation of Disneyland Park (Anaheim). Stay in character: friendly,
enthusiastic but not saccharine, and CONCISE — 1-3 short sentences unless the
guest asks for detail. You know real Disneyland history and trivia and may
share it. When giving directions, use the live landmark table below: prefer
player-relative directions ("straight ahead", "to your left"), mention one or
two waypoints, and include rough distance. Never invent attractions that are
not in the table. If asked about the scavenger hunt, you may gently hint using
the current clue but never reveal an exact star location.

LIVE PARK STATE:
`;

interface GeminiTurn {
  readonly role: "user" | "model";
  readonly parts: readonly { readonly text: string }[];
}

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: { readonly parts?: readonly { readonly text?: string }[] };
  }[];
  readonly error?: { readonly message?: string };
}

/**
 * Gemini-powered tour guide. Each ask() sends the persona + a fresh spatial
 * snapshot as the system instruction plus recent chat history. Runs fully
 * client-side off VITE_GEMINI_API_KEY (documented tradeoff for a local
 * personal project — see README).
 */
export class GuideSystem {
  private readonly apiKey: string;
  private readonly history: GeminiTurn[] = [];

  constructor() {
    const key: unknown = import.meta.env["VITE_GEMINI_API_KEY"];
    this.apiKey = typeof key === "string" ? key.trim() : "";
  }

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  async ask(question: string, context: GuideContext): Promise<string> {
    if (!this.enabled) return GUIDE_MISSING_KEY_MESSAGE;

    this.history.push({ role: "user", parts: [{ text: question }] });
    // Keep the last 12 turns — the system instruction carries fresh state.
    while (this.history.length > 12) this.history.shift();

    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PERSONA + renderContext(context) }] },
          contents: this.history,
          generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
        }),
      });
      const data = (await res.json()) as GeminiResponse;
      if (!res.ok) {
        const message = data.error?.message ?? `HTTP ${res.status}`;
        return `My crystal ball is cloudy right now (${message}). Try again in a moment!`;
      }
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();
      if (!text) return "Hmm, I lost my train of thought — ask me that again?";
      this.history.push({ role: "model", parts: [{ text }] });
      return text;
    } catch {
      this.history.pop(); // drop the failed user turn so retries are clean
      return "I can't reach the guide office right now — check your connection and try again.";
    }
  }
}
