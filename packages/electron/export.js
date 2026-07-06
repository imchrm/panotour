'use strict';

const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

function tourJsonContent(tourJson) {
  if (typeof tourJson === 'string') {
    JSON.parse(tourJson);
    return tourJson;
  }
  if (tourJson === null || typeof tourJson !== 'object') {
    throw new Error(`Invalid tour data: expected object or JSON string, got ${typeof tourJson}`);
  }
  return JSON.stringify(tourJson, null, 2) + '\n';
}

function exportToFolder(outDir, roots, tourJson) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(roots.viewerDir, outDir, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'tour.json',
  });
  const tilesDir = path.join(roots.projectDir, 'tiles');
  if (fs.existsSync(tilesDir)) {
    fs.cpSync(tilesDir, path.join(outDir, 'tiles'), { recursive: true });
  }
  const mediaDir = path.join(roots.projectDir, 'media');
  if (fs.existsSync(mediaDir)) {
    fs.cpSync(mediaDir, path.join(outDir, 'media'), { recursive: true });
  }
  fs.writeFileSync(path.join(outDir, 'tour.json'), tourJsonContent(tourJson), 'utf8');
  return outDir;
}

function exportToZip(outFile, roots, tourJson) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolve(outFile));
    archive.on('error', reject);
    archive.pipe(output);

    archive.glob('**/*', { cwd: roots.viewerDir, ignore: ['tour.json'] });
    const tilesDir = path.join(roots.projectDir, 'tiles');
    if (fs.existsSync(tilesDir)) archive.directory(tilesDir, 'tiles');
    const mediaDir = path.join(roots.projectDir, 'media');
    if (fs.existsSync(mediaDir)) archive.directory(mediaDir, 'media');
    archive.append(tourJsonContent(tourJson), { name: 'tour.json' });

    archive.finalize();
  });
}

module.exports = { exportToFolder, exportToZip };
