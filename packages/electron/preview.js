'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const PREVIEW_SCHEME = 'ptour';

function writePreviewTour(tourJson) {
  const dir = path.join(os.tmpdir(), 'panotour-preview');
  fs.mkdirSync(dir, { recursive: true });
  const content = typeof tourJson === 'string'
    ? tourJson
    : JSON.stringify(tourJson, null, 2) + '\n';
  fs.writeFileSync(path.join(dir, 'tour.json'), content, 'utf8');
  return dir;
}

function resolveViewerDir(appRoot, execPath) {
  const candidates = [
    path.join(appRoot, '..', 'viewer'),
    path.join(path.dirname(execPath), 'viewer'),
  ];
  const found = candidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
  if (!found) {
    throw new Error(`viewer not found, tried: ${candidates.join('; ')}`);
  }
  return found;
}

function resolvePreviewFile(pathname, roots) {
  let rel;
  try {
    rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (rel === '') rel = 'index.html';

  let base;
  if (rel === 'tour.json') {
    base = roots.previewDir;
  } else if (rel.startsWith('tiles/') || rel.startsWith('media/')) {
    base = roots.projectDir;
  } else {
    base = roots.viewerDir;
  }
  if (!base) return null;

  const absBase = path.resolve(base);
  const abs = path.resolve(absBase, rel);
  if (abs !== absBase && !abs.startsWith(absBase + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

module.exports = { PREVIEW_SCHEME, writePreviewTour, resolveViewerDir, resolvePreviewFile };
