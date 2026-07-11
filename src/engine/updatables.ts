/**
 * Registry of per-frame animation hooks (clock hands, waving flags, the
 * railroad train, steamboat paddle wheel, smoke puffs…). World builders
 * register callbacks at construction; the main loop calls updateAll(dt)
 * once per frame. Frozen mode (?freeze=1) skips these along with the rest
 * of the simulation, keeping screenshots deterministic.
 *
 * Each hook is isolated: a throwing animation is disabled and reported
 * (once) instead of killing the render loop.
 */

type Updatable = (dt: number, time: number) => void;

interface Hook {
  fn: Updatable;
  dead: boolean;
}

const hooks: Hook[] = [];
let elapsed = 0;

export function registerUpdatable(fn: Updatable): void {
  hooks.push({ fn, dead: false });
}

export function updateAll(dt: number): void {
  elapsed += dt;
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    if (!hook || hook.dead) continue;
    try {
      hook.fn(dt, elapsed);
    } catch (err) {
      hook.dead = true;
      console.error(`updatable #${i} disabled after throwing:`, err);
    }
  }
}
