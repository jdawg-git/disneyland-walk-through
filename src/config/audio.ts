/**
 * Per-land background audio. Drop your own MP3s into /public/audio/ using
 * these exact filenames (silent placeholders ship by default), or edit the
 * paths here. Zone boundaries are the land polygons in src/config/lands.ts.
 */
export const AUDIO_ZONES = {
  mainStreet: { file: "/audio/main-street.mp3" },
  adventureland: { file: "/audio/adventureland.mp3" },
  neworleans: { file: "/audio/new-orleans-square.mp3" },
  frontierland: { file: "/audio/frontierland.mp3" },
  critterCountry: { file: "/audio/critter-country.mp3" },
  fantasyland: { file: "/audio/fantasyland.mp3" },
  toontown: { file: "/audio/toontown.mp3" },
  tomorrowland: { file: "/audio/tomorrowland.mp3" },
  hub: { file: "/audio/hub.mp3" },
} as const;

export type AudioZoneId = keyof typeof AUDIO_ZONES;

/** Seconds to crossfade between land tracks. */
export const CROSSFADE_SECONDS = 1.5;
