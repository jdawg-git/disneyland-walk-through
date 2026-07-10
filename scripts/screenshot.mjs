#!/usr/bin/env node
/**
 * Automated visual verification: boots the Vite dev server, drives headless
 * Chromium (Playwright) through every viewpoint in viewpoints.json in BOTH
 * day and night, and writes PNGs to verify/. Also asserts a placeholder MP3
 * is decoder-valid via decodeAudioData.
 *
 *   npm run verify            all viewpoints, day + night
 *   npm run verify -- name    only viewpoints whose name includes "name"
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "verify");
const filter = process.argv[2] ?? "";

const { viewpoints } = JSON.parse(readFileSync(join(ROOT, "scripts", "viewpoints.json"), "utf8"));

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["vite", "--port", "5199", "--strictPort"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const onData = (chunk) => {
      output += chunk.toString();
      const m = output.match(/Local:\s+(http:\/\/[^\s]+)/);
      if (m) resolve({ proc, url: m[1].replace(/\/$/, "") });
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => reject(new Error(`vite exited (${code}): ${output}`)));
    setTimeout(() => reject(new Error(`vite did not start: ${output}`)), 30000);
  });
}

const { proc, url } = await startVite();
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ["--headless=new", "--enable-unsafe-swiftshader", "--use-gl=angle"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on("pageerror", (err) => console.error(`PAGE ERROR: ${err.message}`));

let failures = 0;
try {
  for (const vp of viewpoints) {
    if (filter && !vp.name.includes(filter)) continue;
    for (const time of ["day", "night"]) {
      const target = `${url}/?cam=${vp.cam}&time=${time}&hud=0&freeze=1&seed=42`;
      await page.goto(target, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__PARK_READY__ === true, null, { timeout: 30000 });
      await page.waitForTimeout(250);
      const file = join(OUT_DIR, `${vp.name}-${time}.png`);
      await page.screenshot({ path: file });
      console.log(`captured ${vp.name}-${time}.png`);
    }
  }

  // Placeholder MP3s must be decoder-valid, not just present.
  const audioOk = await page.evaluate(async () => {
    const res = await fetch("/audio/main-street.mp3");
    if (!res.ok) return `fetch failed: ${res.status}`;
    const buf = await res.arrayBuffer();
    try {
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf);
      await ctx.close();
      return decoded.duration > 0.5 ? "ok" : `too short: ${decoded.duration}`;
    } catch (e) {
      return `decode failed: ${e}`;
    }
  });
  if (audioOk === "ok") {
    console.log("audio: placeholder decodes OK");
  } else {
    console.error(`audio: ${audioOk}`);
    failures += 1;
  }
} finally {
  await browser.close();
  proc.kill("SIGTERM");
}

if (failures > 0) {
  console.error(`verify finished with ${failures} failure(s)`);
  process.exit(1);
}
console.log(`verify complete → ${OUT_DIR}`);
process.exit(0);
