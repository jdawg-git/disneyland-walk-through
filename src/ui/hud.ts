import "./hud.css";
import type { DayNightSystem } from "../engine/dayNight";
import type { AudioZoneSystem } from "../systems/audioZones";
import type { GuideSystem, GuideContext } from "../systems/guide";
import type { ScavengerSystem } from "../systems/scavenger";
import type { ZoneTracker } from "../systems/zoneTracker";

export interface HudDeps {
  readonly dayNight: DayNightSystem;
  readonly audio: AudioZoneSystem;
  readonly scavenger: ScavengerSystem;
  readonly zones: ZoneTracker;
  readonly guide: GuideSystem;
  readonly crowd: {
    readonly label: () => string;
    readonly date: () => string;
    readonly setDate: (d: string) => void;
  };
  readonly guideContext: () => GuideContext;
}

/**
 * The single HUD overlay: land label + legend (top left), environment
 * controls (top right), scavenger progress (bottom right), guide chat
 * (bottom left). `H` toggles visibility. Plain DOM — systems push state via
 * their event emitters.
 */
export function createHud(deps: HudDeps): void {
  const hud = document.createElement("div");
  hud.id = "hud";
  hud.innerHTML = `
    <div class="hud-panel" id="hud-status">
      <div id="hud-land">Disneyland</div>
      <div id="hud-legend">WASD move · mouse look · Shift sprint<br>N day/night · H hide HUD · Esc mouse</div>
    </div>
    <div class="hud-panel" id="hud-env">
      <div class="hud-row">
        <label>Time</label>
        <button id="hud-daynight">Switch to night</button>
      </div>
      <div class="hud-row">
        <label>Visit date</label>
        <input type="date" id="hud-date" />
      </div>
      <div class="hud-row"><span id="hud-crowd-label"></span></div>
      <div class="hud-row">
        <label>Audio</label>
        <span>
          <button id="hud-mute">Mute</button>
          <input type="range" id="hud-volume" min="0" max="100" value="70" />
        </span>
      </div>
    </div>
    <div class="hud-panel" id="hud-hunt">
      <h3>Scavenger hunt</h3>
      <div id="hud-hunt-count"></div>
      <div id="hud-hunt-clue"></div>
      <button id="hud-hunt-reset">Reset hunt</button>
    </div>
    <div class="hud-panel collapsed" id="hud-guide">
      <div id="hud-guide-header">
        <h3>Park guide</h3>
        <button id="hud-guide-toggle">Chat</button>
      </div>
      <div id="hud-guide-body">
        <div id="hud-guide-log"></div>
        <input id="hud-guide-input" placeholder="Ask the guide… (Enter to send)" />
      </div>
    </div>`;
  document.body.appendChild(hud);

  const el = <T extends HTMLElement>(id: string): T => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`HUD element #${id} missing`);
    return node as T;
  };

  // --- visibility ---
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code === "KeyH" && document.activeElement?.tagName !== "INPUT") {
      hud.classList.toggle("hidden");
    }
  });

  // --- land label ---
  const landLabel = el<HTMLDivElement>("hud-land");
  deps.zones.events.on("landChange", ({ land }) => {
    landLabel.textContent = land ? land.name : "Backstage";
  });

  // --- day/night ---
  const dayNightButton = el<HTMLButtonElement>("hud-daynight");
  const refreshDayNight = (): void => {
    dayNightButton.textContent =
      deps.dayNight.timeOfDay === "day" ? "Switch to night" : "Switch to day";
  };
  dayNightButton.addEventListener("click", () => {
    deps.dayNight.toggle();
    refreshDayNight();
    dayNightButton.blur();
  });
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code === "KeyN" && document.activeElement?.tagName !== "INPUT") refreshDayNight();
  });
  refreshDayNight();

  // --- date picker → crowd model ---
  const dateInput = el<HTMLInputElement>("hud-date");
  const crowdLabel = el<HTMLSpanElement>("hud-crowd-label");
  dateInput.value = deps.crowd.date();
  crowdLabel.textContent = deps.crowd.label();
  dateInput.addEventListener("change", () => {
    if (dateInput.value) {
      deps.crowd.setDate(dateInput.value);
      crowdLabel.textContent = deps.crowd.label();
    }
  });

  // --- audio ---
  const muteButton = el<HTMLButtonElement>("hud-mute");
  const volumeSlider = el<HTMLInputElement>("hud-volume");
  muteButton.addEventListener("click", () => {
    deps.audio.setMuted(!deps.audio.muted);
    muteButton.textContent = deps.audio.muted ? "Unmute" : "Mute";
    muteButton.blur();
  });
  volumeSlider.addEventListener("input", () => {
    deps.audio.setVolume(Number(volumeSlider.value) / 100);
  });

  // --- scavenger ---
  const huntCount = el<HTMLDivElement>("hud-hunt-count");
  const huntClue = el<HTMLDivElement>("hud-hunt-clue");
  const renderHunt = (s: {
    collected: number;
    total: number;
    clue: string | null;
    complete: boolean;
  }): void => {
    huntCount.textContent = `★ ${s.collected} / ${s.total}`;
    huntClue.textContent = s.complete
      ? "You found them all! Enjoy the celebration."
      : (s.clue ?? "");
  };
  deps.scavenger.events.on("progress", renderHunt);
  renderHunt(deps.scavenger.state);
  el<HTMLButtonElement>("hud-hunt-reset").addEventListener("click", (e) => {
    deps.scavenger.reset();
    (e.currentTarget as HTMLButtonElement).blur();
  });

  // --- guide chat ---
  const guidePanel = el<HTMLDivElement>("hud-guide");
  const guideToggle = el<HTMLButtonElement>("hud-guide-toggle");
  const guideLog = el<HTMLDivElement>("hud-guide-log");
  const guideInput = el<HTMLInputElement>("hud-guide-input");

  guideToggle.addEventListener("click", () => {
    guidePanel.classList.toggle("collapsed");
    guideToggle.textContent = guidePanel.classList.contains("collapsed") ? "Chat" : "Hide";
    if (!guidePanel.classList.contains("collapsed")) guideInput.focus();
  });

  const pushMessage = (kind: "user" | "bot", text: string): void => {
    const msg = document.createElement("div");
    msg.className = `guide-msg ${kind}`;
    msg.textContent = text;
    guideLog.appendChild(msg);
    guideLog.scrollTop = guideLog.scrollHeight;
  };

  guideInput.addEventListener("keydown", (e: KeyboardEvent) => {
    e.stopPropagation(); // don't move the player while typing
    if (e.key !== "Enter") return;
    const question = guideInput.value.trim();
    if (question.length === 0) return;
    guideInput.value = "";
    pushMessage("user", question);
    void deps.guide.ask(question, deps.guideContext()).then((answer) => {
      pushMessage("bot", answer);
    });
  });
  guideInput.addEventListener("keyup", (e: KeyboardEvent) => e.stopPropagation());
}
