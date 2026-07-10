/**
 * The scavenger hunt: golden stars found IN SEQUENCE — collecting one
 * reveals the clue to the next. Edit freely: `position` is [x, y, z] in
 * park meters (y = height off the ground), `clue` is the text revealed by
 * the PREVIOUS star (clue[0] shows at hunt start).
 *
 * Stage 2 ships the first star; the full park route arrives in stage 6.
 */

export interface StarDef {
  readonly id: number;
  readonly position: readonly [number, number, number];
  /** Clue pointing TO this star (shown after collecting the previous one). */
  readonly clue: string;
}

export const STARS: readonly StarDef[] = [
  {
    id: 1,
    position: [2, 1.4, 322],
    clue: "Your day begins where steam and whistle greet the square — look beneath the station clock.",
  },
];
