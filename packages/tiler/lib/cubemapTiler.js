'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const JPEG_QUALITY = 85;
const PREVIEW_SIZE = 256;

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

// Resize face buffer from maxFaceSize to targetSize (if needed) and write
// all tileSize×tileSize tiles for one face at one level.
async function writeFaceTiles(faceBuf, maxFaceSize, ch, levelDir, faceIdx, targetSize, tileSize) {
  let buf = faceBuf;
  if (maxFaceSize !== targetSize) {
    buf = await sharp(faceBuf, { raw: { width: maxFaceSize, height: maxFaceSize, channels: ch } })
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

      const tileDir = path.join(levelDir, String(faceIdx), String(ty));
      fs.mkdirSync(tileDir, { recursive: true });

      await sharp(buf, { raw: { width: targetSize, height: targetSize, channels: ch } })
        .extract({ left, top, width: w, height: h })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(path.join(tileDir, `${tx}.jpg`));
    }
  }
}

/**
 * Main entry point.
 *
 * @param {string}   inputPath   - Source equirectangular JPEG/PNG
 * @param {string}   outputDir   - Destination directory (already created by caller)
 * @param {string}   sceneId     - Scene identifier (informational only)
 * @param {number}   maxFaceSize - Face resolution to project at (power of 2)
 * @param {Array}    levels      - Level descriptors: [{ size, tileSize, fallbackOnly? }]
 * @param {Function} onProgress  - Optional callback (msg: string) for status updates
 */
async function tileScene(inputPath, outputDir, sceneId, maxFaceSize, levels, onProgress) {
  const { data: srcPixels, info } = await sharp(inputPath)
    .toColorspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: ch } = info;

  // Project all 6 faces at maxFaceSize once
  const faceBuffers = [];
  for (let f = 0; f < 6; f++) {
    onProgress && onProgress(`Projecting face ${f + 1}/6`);
    faceBuffers.push(projectFace(srcPixels, W, H, ch, f, maxFaceSize));
  }

  // Write tiles for every level × every face
  for (let li = 0; li < levels.length; li++) {
    const { size, tileSize } = levels[li];
    const levelDir = path.join(outputDir, String(li + 1));

    for (let f = 0; f < 6; f++) {
      onProgress && onProgress(`Level ${li + 1}/${levels.length}, face ${f + 1}/6`);
      await writeFaceTiles(faceBuffers[f], maxFaceSize, ch, levelDir, f, size, tileSize);
    }
  }

  // Preview: front face (+Z, index 4) at PREVIEW_SIZE
  onProgress && onProgress('Writing preview.jpg');
  await sharp(faceBuffers[4], { raw: { width: maxFaceSize, height: maxFaceSize, channels: ch } })
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, { kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 80 })
    .toFile(path.join(outputDir, 'preview.jpg'));
}

module.exports = { tileScene };
