#!/usr/bin/env node
/**
 * Generates silent placeholder MP3s for every audio zone so the app runs
 * before the user drops in real music. Pure Node — builds valid MPEG-1
 * Layer III frames by hand (no ffmpeg required); uses ffmpeg when available
 * for LAME-tagged output.
 *
 * Keep FILES in sync with src/config/audio.ts AUDIO_ZONES.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = [
  "main-street.mp3",
  "adventureland.mp3",
  "new-orleans-square.mp3",
  "frontierland.mp3",
  "critter-country.mp3",
  "fantasyland.mp3",
  "toontown.mp3",
  "tomorrowland.mp3",
  "hub.mp3",
];

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");
const SECONDS = 3;

mkdirSync(OUT_DIR, { recursive: true });

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

if (hasFfmpeg) {
  for (const name of FILES) {
    const out = join(OUT_DIR, name);
    const r = spawnSync(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(SECONDS), "-b:a", "128k", out],
      { stdio: "ignore" },
    );
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
    console.log(`ffmpeg: ${name}`);
  }
} else {
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz, joint stereo, no CRC.
  // Frame length = floor(144 * 128000 / 44100) = 417 bytes.
  // Zeroed side info (part2_3_length = 0) decodes as silence everywhere.
  const FRAME_BYTES = 417;
  const frame = Buffer.alloc(FRAME_BYTES, 0);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x64;
  const framesPerSecond = 44100 / 1152; // ≈ 38.28
  const frameCount = Math.ceil(framesPerSecond * SECONDS);
  const file = Buffer.concat(Array.from({ length: frameCount }, () => frame));
  for (const name of FILES) {
    writeFileSync(join(OUT_DIR, name), file);
    console.log(`node: ${name} (${file.length} bytes, ${frameCount} frames)`);
  }
}

console.log(`Wrote ${FILES.length} silent placeholders to public/audio/`);
