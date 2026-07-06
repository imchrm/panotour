'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function sha1File(filePath) {
  const hash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
  return `sha1:${hash}`;
}

function resolveTilerPath(appRoot, execPath) {
  const candidates = [
    path.join(appRoot, '..', 'tiler', 'tiler.js'),
    path.join(path.dirname(execPath), 'tiler', 'tiler.js'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`tiler.js not found, tried: ${candidates.join('; ')}`);
  }
  return found;
}

function runTiler(tilerPath, projectDir, sceneId, onProgress) {
  const inputFile = path.join(projectDir, 'scenes', `${sceneId}.jpg`);
  const outputDir = path.join(projectDir, 'tiles', sceneId);

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputFile)) {
      reject(new Error(`Panorama not found: ${inputFile}`));
      return;
    }
    const child = spawn('node', [
      tilerPath,
      '--input',  inputFile,
      '--output', outputDir,
      '--id',     sceneId,
      '--mobile',
    ]);

    let stderr = '';
    child.stdout.on('data', (data) => {
      if (onProgress) onProgress(data.toString());
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tiler exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'),
        );
        const result = {
          sceneId,
          tilesPath: `tiles/${sceneId}`,
          previewUrl: `tiles/${sceneId}/preview.jpg`,
          levels: manifest.levels,
          sourceHash: sha1File(inputFile),
          tiledAt: new Date().toISOString(),
        };
        const mobileManifest = path.join(outputDir, 'mobile', 'manifest.json');
        if (fs.existsSync(mobileManifest)) {
          result.mobileLevels = JSON.parse(fs.readFileSync(mobileManifest, 'utf8')).levels;
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
}

module.exports = { sha1File, resolveTilerPath, runTiler, runPool };
