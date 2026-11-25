#!/usr/bin/env node
// Generates the original bundled preset images in images/.
//
//   node scripts/generate-presets.mjs
//
// Requires the `canvas` dev dependency and libwebp's `cwebp` and `img2webp`
// (e.g. `brew install webp`). Presets are drawn at the panel's native
// 128 × 128 so they ship small and need no scaling. Output is deterministic,
// so regenerated files keep their regression hashes unless the drawing changes.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas } from "canvas";

const imagesDirectory = join(import.meta.dirname, "..", "images");
const TAU = Math.PI * 2;

/** Small deterministic PRNG so stars land in the same place every run. */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function drawSunset(ctx, size) {
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, "#1b1446");
  sky.addColorStop(0.45, "#7b2d6b");
  sky.addColorStop(0.7, "#f2684a");
  sky.addColorStop(1, "#ffd27a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  const sun = ctx.createRadialGradient(size / 2, size * 0.66, 0, size / 2, size * 0.66, size * 0.22);
  sun.addColorStop(0, "#fff6d5");
  sun.addColorStop(0.6, "#ffc65c");
  sun.addColorStop(1, "rgba(255, 160, 80, 0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(size / 2, size * 0.66, size * 0.22, 0, TAU);
  ctx.fill();

  const ridge = (color, base, amplitude, frequency, phase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let x = 0; x <= size; x += 2) {
      const t = x / size;
      const y =
        base +
        Math.sin(t * frequency * TAU + phase) * amplitude +
        Math.sin(t * frequency * 2.7 * TAU + phase * 1.9) * amplitude * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fill();
  };
  ridge("#5a2350", size * 0.72, size * 0.05, 1.3, 0.4);
  ridge("#3a1740", size * 0.8, size * 0.04, 1.8, 2.1);
  ridge("#1d0c26", size * 0.88, size * 0.03, 2.4, 4.0);
}

function drawOrbitFrame(ctx, size, frame, frameCount) {
  ctx.fillStyle = "#070b1f";
  ctx.fillRect(0, 0, size, size);

  const stars = random(7);
  for (let i = 0; i < 60; i++) {
    const x = stars() * size;
    const y = stars() * size;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(frame / 3 + i));
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }

  const cx = size / 2;
  const cy = size / 2;
  const angle = (frame / frameCount) * TAU;
  const moonX = cx + Math.cos(angle) * size * 0.36;
  const moonY = cy + Math.sin(angle) * size * 0.14;
  const moonBehind = Math.sin(angle) < 0;

  const drawMoon = () => {
    ctx.fillStyle = "#d9e3ff";
    ctx.beginPath();
    ctx.arc(moonX, moonY, size * 0.06, 0, TAU);
    ctx.fill();
  };

  ctx.strokeStyle = "rgba(140, 170, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.36, size * 0.14, 0, 0, TAU);
  ctx.stroke();

  if (moonBehind) drawMoon();

  const planet = ctx.createRadialGradient(cx - size * 0.07, cy - size * 0.07, size * 0.02, cx, cy, size * 0.2);
  planet.addColorStop(0, "#7fe0ff");
  planet.addColorStop(0.55, "#2f7de1");
  planet.addColorStop(1, "#132b6b");
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.2, 0, TAU);
  ctx.fill();

  if (!moonBehind) drawMoon();
}

function drawAuroraFrame(ctx, size, frame, frameCount) {
  ctx.fillStyle = "#04121a";
  ctx.fillRect(0, 0, size, size);
  const phase = (frame / frameCount) * TAU;
  const bands = [
    ["rgba(60, 255, 170, 0.55)", 0.32, 0],
    ["rgba(90, 200, 255, 0.45)", 0.42, 1.7],
    ["rgba(190, 110, 255, 0.4)", 0.52, 3.4],
  ];
  for (const [color, base, offset] of bands) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let x = 0; x <= size; x += 2) {
      const t = x / size;
      const y = size * base + Math.sin(t * TAU * 1.5 + phase + offset) * size * 0.08;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#020a0f";
  ctx.fillRect(0, size * 0.84, size, size * 0.16);
}

const SIZE = 128;

function withFrames(frameCount, draw, encode) {
  const workDirectory = mkdtempSync(join(tmpdir(), "ak820-preset-"));
  try {
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext("2d");
    const paths = [];
    for (let frame = 0; frame < frameCount; frame++) {
      draw(ctx, SIZE, frame, frameCount);
      const path = join(workDirectory, `frame-${String(frame).padStart(3, "0")}.png`);
      writeFileSync(path, canvas.toBuffer("image/png"));
      paths.push(path);
    }
    encode(paths);
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

function writeStill(name, draw) {
  withFrames(1, draw, ([path]) =>
    execFileSync("cwebp", ["-quiet", "-q", "85", path, "-o", join(imagesDirectory, name)]),
  );
}

function writeAnimation(name, frameCount, delayMs, draw) {
  withFrames(frameCount, draw, (paths) =>
    execFileSync("img2webp", [
      "-loop", "0", "-lossy", "-q", "75", "-d", String(delayMs),
      ...paths, "-o", join(imagesDirectory, name),
    ]),
  );
}

writeStill("sunset.webp", drawSunset);
writeAnimation("orbit.webp", 16, 80, drawOrbitFrame);
writeAnimation("aurora.webp", 20, 90, drawAuroraFrame);
console.log("Wrote images/sunset.webp, images/orbit.webp and images/aurora.webp");
