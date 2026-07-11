const MAX_DT = 0.1; // clamp tab-switch spikes

/**
 * requestAnimationFrame loop with clamped delta. dt is clamped to [0, MAX_DT]:
 * the first rAF timestamp can PRECEDE a performance.now() captured just
 * before scheduling (the timestamp is the frame's vsync time), producing a
 * negative delta that NaN-poisons downstream math (curve parameterization).
 */
export function startLoop(tick: (dt: number) => void): void {
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.max(0, Math.min((now - last) / 1000, MAX_DT));
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
