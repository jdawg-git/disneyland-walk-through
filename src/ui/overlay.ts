/**
 * Entry + pause overlay. The fullscreen "click to enter" card shows only
 * before FIRST entry (acquiring pointer lock and unlocking the AudioContext
 * must share one user gesture). After that, releasing the mouse (Esc) shows
 * a small non-blocking pill instead, leaving the HUD fully clickable —
 * clicking the 3D view (canvas only, not HUD panels) re-locks.
 */
export function createStartOverlay(
  canvas: HTMLCanvasElement,
  onEnter: () => void,
): void {
  const overlay = document.createElement("div");
  overlay.id = "start-overlay";
  overlay.innerHTML = `
    <div class="start-card">
      <h1>Disneyland Virtual</h1>
      <p>Click to enter the park</p>
      <p class="controls-hint">WASD move &middot; mouse look &middot; hold Shift to run &middot; N day/night<br>H hide HUD &middot; Esc frees the cursor for the menus</p>
    </div>`;
  document.body.appendChild(overlay);

  const pill = document.createElement("div");
  pill.id = "resume-pill";
  pill.textContent = "Cursor free — use the menus, or click the view to keep walking";
  pill.style.display = "none";
  document.body.appendChild(pill);

  let entered = false;

  // requestPointerLock can reject (permissions, headless, iframes) — the
  // game must stay usable either way, so never gate the overlay on it.
  const tryLock = (): void => {
    try {
      void (canvas.requestPointerLock() as Promise<void> | undefined)?.catch(() => {});
    } catch {
      // mouse-look unavailable; HUD and keyboard still work
    }
  };

  overlay.addEventListener("click", () => {
    entered = true;
    overlay.style.display = "none";
    tryLock();
    onEnter();
  });

  // After first entry, clicking the canvas itself re-locks (HUD clicks don't).
  canvas.addEventListener("click", () => {
    if (entered && document.pointerLockElement !== canvas) tryLock();
  });

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    overlay.style.display = locked || entered ? "none" : "flex";
    pill.style.display = !locked && entered ? "block" : "none";
  });
  document.addEventListener("pointerlockerror", () => {
    if (entered) pill.style.display = "block";
  });
}
