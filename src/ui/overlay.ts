/**
 * "Click to enter" overlay. Acquiring pointer lock and unlocking the
 * AudioContext must happen in the same user gesture (browser autoplay
 * policy), so both hooks fire from this single click handler.
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
      <p class="controls-hint">WASD move &middot; mouse look &middot; Shift sprint &middot; N day/night &middot; H hide HUD &middot; Esc release mouse</p>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", () => {
    canvas.requestPointerLock();
    onEnter();
  });

  document.addEventListener("pointerlockchange", () => {
    overlay.style.display = document.pointerLockElement === canvas ? "none" : "flex";
  });
}
