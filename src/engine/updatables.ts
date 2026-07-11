/**
 * Registry of per-frame animation hooks (clock hands, waving flags, the
 * railroad train, steamboat paddle wheel, smoke puffs…). World builders
 * register callbacks at construction; the main loop calls updateAll(dt)
 * once per frame. Frozen mode (?freeze=1) skips these along with the rest
 * of the simulation, keeping screenshots deterministic.
 */

type Updatable = (dt: number, time: number) => void;

const hooks: Updatable[] = [];
let elapsed = 0;

export function registerUpdatable(fn: Updatable): void {
  hooks.push(fn);
}

export function updateAll(dt: number): void {
  elapsed += dt;
  for (const fn of hooks) fn(dt, elapsed);
}
