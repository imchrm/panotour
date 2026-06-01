'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Determine desktop tile levels based on equirectangular input width.
 * Face size = W/4, rounded down to nearest power of 2.
 * Level 1 (fallback) is always 256x256, one tile per face.
 */
function computeLevels(inputWidth) {
  const rawFaceSize = Math.round(inputWidth / 4);
  let faceSize = 256;
  while (faceSize * 2 <= rawFaceSize && faceSize * 2 <= 4096) {
    faceSize *= 2;
  }

  const levels = [{ tileSize: 256, size: 256, fallbackOnly: true }];
  if (faceSize >= 512)  levels.push({ tileSize: 512, size: 512 });
  if (faceSize >= 1024) levels.push({ tileSize: 512, size: 1024 });
  if (faceSize >= 2048) levels.push({ tileSize: 512, size: 2048 });
  if (faceSize >= 4096) levels.push({ tileSize: 512, size: 4096 });

  return { faceSize, levels };
}

/**
 * Mobile tile levels: face capped at 512px, tileSize=256.
 * Smaller tileSize means smaller individual GPU textures (256×256 max vs 512×512).
 *
 * Effective even when desktopFaceSize === 512: mobile gets 4 tiles per face
 * (256px each) instead of 1 tile (512px), halving the peak GPU texture size.
 */
function computeMobileLevels(desktopFaceSize) {
  const faceSize = Math.min(512, desktopFaceSize);
  const levels = [{ tileSize: 256, size: 256, fallbackOnly: true }];
  if (faceSize >= 512) levels.push({ tileSize: 256, size: 512 });
  return { faceSize, levels };
}

/**
 * Write manifest.json to outputDir.
 * manifest.json is read by the editor to populate scene.levels in tour.json.
 *
 * Face order in tiles/{z}/{f}/{y}/{x}.jpg:
 *   0 = +X (right), 1 = -X (left), 2 = +Y (up),
 *   3 = -Y (down),  4 = +Z (front), 5 = -Z (back)
 */
function writeManifest(outputDir, sceneId, levels, filename = 'manifest.json') {
  const manifest = { sceneId, levels };
  fs.writeFileSync(
    path.join(outputDir, filename),
    JSON.stringify(manifest, null, 2)
  );
}

module.exports = { computeLevels, computeMobileLevels, writeManifest };
