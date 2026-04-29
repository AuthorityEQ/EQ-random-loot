/**
 * Generates PWA icons for Frostreaver Loot Buckets.
 *
 * Design: Dark green background (#2d6a4f) with a white snowflake/ice-crystal
 * SVG centered on the canvas. The "FR" initials appear below the snowflake.
 *
 * The maskable variant adds extra padding (safe-zone = 80% of canvas) so
 * critical artwork stays inside the clipping circle on Android.
 *
 * Usage:  node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const GITKEEP = path.join(ICONS_DIR, '.gitkeep');

// ── Brand values ────────────────────────────────────────────────────────────
const BG   = '#2d6a4f';   // Frostreaver green
const FG   = '#ffffff';   // white artwork
const ACCENT = '#a8dbc5'; // soft mint for inner glow

// ── SVG builder ─────────────────────────────────────────────────────────────

/**
 * Builds an SVG string for the icon.
 *
 * @param {number} size       - Canvas dimension in px (square)
 * @param {number} scaleFactor - 0–1; shrinks artwork toward center (maskable = 0.72)
 */
function buildSvg(size, scaleFactor = 1) {
  const half  = size / 2;
  const scale = scaleFactor;

  // Snowflake geometry — 6-arm crystal with secondary branches
  // All coordinates are defined in a normalised ±1 space then scaled by `arm`
  const arm = half * 0.38 * scale;   // main arm length
  const branchLen = arm * 0.38;       // secondary branch length
  const branchAngle = 60;             // degrees from arm axis

  // Build the 6-arm snowflake as a path group
  // We rotate 0°,60°,120°,180°,240°,300° around the centre
  const arms = Array.from({ length: 6 }, (_, i) => i * 60);

  // Each arm: a line from centre out, plus two symmetric branches
  // We express everything in polar coords then emit as SVG transforms
  const armSvg = arms.map(angle => {
    const deg = angle;
    return `
      <g transform="rotate(${deg} ${half} ${half})">
        <!-- main arm -->
        <line x1="${half}" y1="${half}" x2="${half}" y2="${half - arm}"
              stroke="${FG}" stroke-width="${size * 0.028 * scale}" stroke-linecap="round"/>
        <!-- branch pair at 60% of arm -->
        <line x1="${half}" y1="${half - arm * 0.58}"
              x2="${half - branchLen * Math.sin(branchAngle * Math.PI / 180)}"
              y2="${half - arm * 0.58 - branchLen * Math.cos(branchAngle * Math.PI / 180)}"
              stroke="${FG}" stroke-width="${size * 0.018 * scale}" stroke-linecap="round"/>
        <line x1="${half}" y1="${half - arm * 0.58}"
              x2="${half + branchLen * Math.sin(branchAngle * Math.PI / 180)}"
              y2="${half - arm * 0.58 - branchLen * Math.cos(branchAngle * Math.PI / 180)}"
              stroke="${FG}" stroke-width="${size * 0.018 * scale}" stroke-linecap="round"/>
        <!-- branch pair at 35% of arm -->
        <line x1="${half}" y1="${half - arm * 0.35}"
              x2="${half - branchLen * 0.55 * Math.sin(branchAngle * Math.PI / 180)}"
              y2="${half - arm * 0.35 - branchLen * 0.55 * Math.cos(branchAngle * Math.PI / 180)}"
              stroke="${FG}" stroke-width="${size * 0.015 * scale}" stroke-linecap="round"/>
        <line x1="${half}" y1="${half - arm * 0.35}"
              x2="${half + branchLen * 0.55 * Math.sin(branchAngle * Math.PI / 180)}"
              y2="${half - arm * 0.35 - branchLen * 0.55 * Math.cos(branchAngle * Math.PI / 180)}"
              stroke="${FG}" stroke-width="${size * 0.015 * scale}" stroke-linecap="round"/>
        <!-- tip cap -->
        <circle cx="${half}" cy="${half - arm}"
                r="${size * 0.022 * scale}" fill="${FG}"/>
      </g>`;
  }).join('\n');

  // Centre jewel
  const jewel = `<circle cx="${half}" cy="${half}"
                          r="${size * 0.052 * scale}"
                          fill="${ACCENT}" stroke="${FG}"
                          stroke-width="${size * 0.012 * scale}"/>`;

  // "FR" text label below the crystal
  const textY  = half + arm * 1.22;
  const fontSize = size * 0.13 * scale;
  const label = `
    <text x="${half}" y="${textY}"
          font-family="Arial, Helvetica, sans-serif"
          font-weight="700"
          font-size="${fontSize}"
          fill="${FG}"
          text-anchor="middle"
          dominant-baseline="middle"
          letter-spacing="${size * 0.012 * scale}">${'FR'}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- background -->
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <!-- subtle radial glow -->
  <defs>
    <radialGradient id="glow" cx="50%" cy="48%" r="42%">
      <stop offset="0%"   stop-color="#3d8a66" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${BG}"   stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)"/>
  <!-- snowflake arms -->
  ${armSvg}
  <!-- centre jewel -->
  ${jewel}
  <!-- initials -->
  ${label}
</svg>`;
}

// ── Icon specs ───────────────────────────────────────────────────────────────

const icons = [
  { filename: 'icon-192.png',     size: 192, scaleFactor: 1     },
  { filename: 'icon-512.png',     size: 512, scaleFactor: 1     },
  { filename: 'icon-maskable.png',size: 512, scaleFactor: 0.72  },
];

// ── Generate ─────────────────────────────────────────────────────────────────

async function generate() {
  for (const { filename, size, scaleFactor } of icons) {
    const svg  = buildSvg(size, scaleFactor);
    const dest = path.join(ICONS_DIR, filename);

    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: false })
      .toFile(dest);

    const { size: bytes } = await sharp(dest).metadata();
    // sharp metadata.size isn't always populated for files — use stat instead
    const { statSync } = await import('fs');
    const fileSize = statSync(dest).size;
    console.log(`  generated ${filename}  (${size}x${size})  ${(fileSize / 1024).toFixed(1)} KB`);
  }

  // Remove the placeholder
  try {
    await rm(GITKEEP);
    console.log('  removed .gitkeep');
  } catch {
    // already gone — fine
  }

  console.log('\nAll icons generated successfully.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
