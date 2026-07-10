const MAX_DT = 0.1; // clamp tab-switch spikes

/** requestAnimationFrame loop with clamped delta. */
export function startLoop(tick: (dt: number) => void): void {
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
