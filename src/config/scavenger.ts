/**
 * The scavenger hunt: golden stars found IN SEQUENCE — collecting one
 * reveals the clue to the next. Edit freely: `position` is [x, y, z] in
 * park meters (y = height off the ground), `clue` is the text that points
 * TO that star (clue of star 1 shows at hunt start).
 *
 * The route walks the park clockwise from the front gate: Main Street →
 * hub → Adventureland → New Orleans Square → Critter Country →
 * Frontierland → Fantasyland → Toontown → Tomorrowland.
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
  {
    id: 2,
    position: [3, 1.4, 218],
    clue: "Stroll up Main Street past the shop windows on your left — the biggest emporium in town keeps a star by its door.",
  },
  {
    id: 3,
    position: [4, 1.4, 52],
    clue: "Walk to the heart of the park, the round plaza where every land begins and the castle watches over all.",
  },
  {
    id: 4,
    position: [-53, 1.4, 103],
    clue: "Head west through the gateway of adventure — the tiki torches burn beside a thatched hall of singing birds.",
  },
  {
    id: 5,
    position: [-208, 1.4, 181],
    clue: "Follow the river southwest into the old French quarter, where pirates whisper behind a grand cream mansion.",
  },
  {
    id: 6,
    position: [-299, 1.4, 145],
    clue: "A little further west a ghostly white manor waits on the hill — its foolish mortals never check the front lawn.",
  },
  {
    id: 7,
    position: [-370, 1.4, 40],
    clue: "Keep walking to the quiet far corner of the park, deep in critter woods along the river's west bank.",
  },
  {
    id: 8,
    position: [-129, 1.4, 48],
    clue: "Double back east along the riverfront until red-rock buttes rise — the wildest ride in the wilderness guards a star at its gate.",
  },
  {
    id: 9,
    position: [6, 1.4, -38],
    clue: "Return to the castle and slip through to the courtyard behind it, where storybooks come to life.",
  },
  {
    id: 10,
    position: [81, 1.4, -56],
    clue: "Look for the snow-capped mountain at the edge of Fantasyland — a star rests near the bobsleds below.",
  },
  {
    id: 11,
    position: [30, 1.4, -242],
    clue: "March north past the singing clock of the world's smallest voyage, into the cartoon town where Mickey lives.",
  },
  {
    id: 12,
    position: [66, 1.4, 62],
    clue: "One last stop: stand at the gateway to the future, where Tomorrowland meets the plaza — then turn back toward the castle.",
  },
];
