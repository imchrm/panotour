'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const JPEG_QUALITY = 85;
const PREVIEW_SIZE = 256;

// Map face index → Marzipano face letter (used in tile URL template {f})
// Index order matches faceDir() above: 0=+X 1=-X 2=+Y 3=-Y 4=+Z 5=-Z
const FACE_NAMES = ['r', 'l', 'u', 'd', 'f', 'b'];

// Map (face, u, v) → unnormalized direction vector.
// u ∈ [-1, 1]: left → right within the face image.
// v ∈ [-1, 1]: top → bottom within the face image.
// Face indices: 0=+X(right) 1=-X(left) 2=+Y(up) 3=-Y(down) 4=+Z(front) 5=-Z(back)
function faceDir(face, u, v) {
  switch (face) {
    case 0: return [  1, -v, -u]; // +X
    case 1: return [ -1, -v,  u]; // -X
    case 2: return [  u,  1,  v]; // +Y
    case 3: return [  u, -1, -v]; // -Y
    case 4: return [  u, -v,  1]; // +Z  (center of equirectangular)
    case 5: return [ -u, -v, -1]; // -Z
  }
}

// Bilinear sample from a raw RGB buffer (srcPixels).
function sampleBilinear(pixels, W, H, ch, x, y) {
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const x1 = Math.min(x0 + 1, W - 1);
  const y1 = Math.min(y0 + 1, H - 1);
  const fx = x - x0;
  const fy = y - y0;

  const out = new Array(ch);
  for (let c = 0; c < ch; c++) {
    const tl = pixels[(y0 * W + x0) * ch + c];
    const tr = pixels[(y0 * W + x1) * ch + c];
    const bl = pixels[(y1 * W + x0) * ch + c];
    const br = pixels[(y1 * W + x1) * ch + c];
    out[c] = Math.round(
      tl * (1 - fx) * (1 - fy) +
      tr * fx       * (1 - fy) +
      bl * (1 - fx) * fy       +
      br * fx       * fy
    );
  }
  return out;
}

// Project one cube face from the equirectangular source buffer.
// Returns a raw RGB Buffer of faceSize×faceSize pixels.
function projectFace(srcPixels, W, H, ch, faceIdx, faceSize) {
  const TAU = 2 * Math.PI;
  const buf = Buffer.alloc(faceSize * faceSize * ch);

  for (let py = 0; py < faceSize; py++) {
    for (let px = 0; px < faceSize; px++) {
      const u = (px + 0.5) / faceSize * 2 - 1;
      const v = (py + 0.5) / faceSize * 2 - 1;

      const [dx, dy, dz] = faceDir(faceIdx, u, v);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      // Spherical coordinates → equirectangular pixel
      const lon = Math.atan2(nx, nz);                             // -π … +π
      const lat = Math.atan2(ny, Math.sqrt(nx * nx + nz * nz));  // -π/2 … +π/2

      const srcX = (lon / TAU + 0.5) * W;
      const srcY = (0.5 - lat / Math.PI) * H;

      const samples = sampleBilinear(srcPixels, W, H, ch, srcX, srcY);
      const dstIdx = (py * faceSize + px) * ch;
      for (let c = 0; c < ch; c++) buf[dstIdx + c] = samples[c];
    }
  }

  return buf;
}

// Resize face buffer from projectedSize to targetSize (if needed) and write
// all tileSize×tileSize tiles for one face at one level.
async function writeFaceTiles(faceBuf, projectedSize, ch, levelDir, faceIdx, targetSize, tileSize) {
  let buf = faceBuf;
  if (projectedSize !== targetSize) {
    buf = await sharp(faceBuf, { raw: { width: projectedSize, height: projectedSize, channels: ch } })
      .resize(targetSize, targetSize, { kernel: sharp.kernel.lanczos3 })
      .raw()
      .toBuffer();
  }

  const nTiles = Math.ceil(targetSize / tileSize);

  for (let ty = 0; ty < nTiles; ty++) {
    for (let tx = 0; tx < nTiles; tx++) {
      const left = tx * tileSize;
      const top  = ty * tileSize;
      const w    = Math.min(tileSize, targetSize - left);
      const h    = Math.min(tileSize, targetSize - top);

      const tileDir = path.join(levelDir, FACE_NAMES[faceIdx], String(ty));
      fs.mkdirSync(tileDir, { recursive: true });

      await sharp(buf, { raw: { width: targetSize, height: targetSize, channels: ch } })
        .extract({ left, top, width: w, height: h })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(path.join(tileDir, `${tx}.jpg`));
    }
  }
}

/**
 * Main entry point. Projects all 6 faces once at the highest faceSize
 * across all targets, then writes tiles and preview for each target.
 *
 * @param {string}   inputPath  - Source equirectangular JPEG/PNG
 * @param {Array}    targets    - [{ outputDir, faceSize, levels, label }]
 * @param {Function} onProgress - Optional callback (msg: string) for status updates
 *
 * Single target (desktop-only):
 *   targets = [{ outputDir, faceSize, levels, label: '' }]
 *
 * Desktop + mobile:
 *   targets = [
 *     { outputDir,              faceSize,       levels,       label: 'desktop' },
 *     { outputDir: mobileDir,   faceSize: 512,  levels: ...,  label: 'mobile'  },
 *   ]
 */
async function tileScene(inputPath, targets, onProgress) {
  const { data: srcPixels, info } = await sharp(inputPath)
    .toColorspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: ch } = info;

  // Project at the largest faceSize needed (always desktop when both targets present).
  // Mobile reuses the same face buffers, downscaling via lanczos3 during tile write.
  const projectedSize = Math.max(...targets.map(t => t.faceSize));

  const faceBuffers = [];
  for (let f = 0; f < 6; f++) {
    onProgress && onProgress(`Projecting face ${f + 1}/6`);
    faceBuffers.push(projectFace(srcPixels, W, H, ch, f, projectedSize));
  }

  for (const { outputDir, faceSize, levels, label } of targets) {
    const prefix = label ? `[${label}] ` : '';

    for (let li = 0; li < levels.length; li++) {
      const { size, tileSize } = levels[li];
      const levelDir = path.join(outputDir, String(li + 1));

      for (let f = 0; f < 6; f++) {
        onProgress && onProgress(`${prefix}Level ${li + 1}/${levels.length}, face ${f + 1}/6`);
        await writeFaceTiles(faceBuffers[f], projectedSize, ch, levelDir, f, size, tileSize);
      }
    }

    onProgress && onProgress(`${prefix}Writing preview.jpg`);
    await sharp(faceBuffers[4], { raw: { width: projectedSize, height: projectedSize, channels: ch } })
      .resize(PREVIEW_SIZE, PREVIEW_SIZE, { kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 80 })
      .toFile(path.join(outputDir, 'preview.jpg'));
  }
}

module.exports = { tileScene };
