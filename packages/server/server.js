'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { tileScene }                              = require('../tiler/lib/cubemapTiler');
const { computeLevels, computeMobileLevels, writeManifest } = require('../tiler/lib/manifest');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const VIEWER_DIR  = path.join(__dirname, '../viewer');
const WORKSPACE   = path.join(__dirname, 'workspace');
const TILES_DIR   = path.join(WORKSPACE, 'tiles');
const UPLOADS_DIR = path.join(WORKSPACE, 'uploads');

fs.mkdirSync(TILES_DIR,   { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT ?? 3333;

app.use(express.json());

// CORS — editor dev server runs on a different port
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static: tile files
app.use('/tiles', express.static(TILES_DIR));

// Static: viewer files (for ZIP export via editor)
app.use('/viewer', express.static(VIEWER_DIR));

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0' });
});

// ---------------------------------------------------------------------------
// POST /api/tile
//
// Multipart fields:
//   panorama  — image file (JPEG / PNG)
//   sceneId   — scene identifier string
//   mobile    — '1' to also generate mobile tiles (optional)
//
// Response:
//   { sceneId, tilesPath, previewUrl, levels, mobileLevels? }
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) =>
      cb(null, `upload-${Date.now()}${path.extname(file.originalname) || '.jpg'}`),
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

app.post('/api/tile', upload.single('panorama'), async (req, res) => {
  const { sceneId, mobile } = req.body ?? {};

  if (!sceneId || !req.file) {
    return res.status(400).json({ error: 'sceneId and panorama file are required' });
  }

  const inputPath  = req.file.path;
  const outputDir  = path.join(TILES_DIR, sceneId);
  const withMobile = mobile === '1' || mobile === true;

  try {
    const sharp = require('sharp');
    const meta  = await sharp(inputPath).metadata();
    if (!meta.width || !meta.height) throw new Error('Cannot read image dimensions');

    const { faceSize, levels } = computeLevels(meta.width);

    const targets = [
      { outputDir, faceSize, levels, label: withMobile ? 'desktop' : '' },
    ];

    if (withMobile) {
      const mobileDir = path.join(outputDir, 'mobile');
      fs.mkdirSync(mobileDir, { recursive: true });
      const { faceSize: mFaceSize, levels: mLevels } = computeMobileLevels(faceSize);
      targets.push({ outputDir: mobileDir, faceSize: mFaceSize, levels: mLevels, label: 'mobile' });
    }

    await tileScene(inputPath, targets);

    writeManifest(outputDir, sceneId, levels);
    if (withMobile) writeManifest(targets[1].outputDir, sceneId, targets[1].levels);

    res.json({
      sceneId,
      tilesPath:  `tiles/${sceneId}`,
      previewUrl: `tiles/${sceneId}/preview.jpg`,
      levels,
      ...(withMobile ? { mobileLevels: targets[1].levels } : {}),
    });
  } catch (err) {
    console.error('[tile] error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(inputPath, () => {});
  }
});

// ---------------------------------------------------------------------------
// GET /api/tile/:sceneId/files
//
// Returns a list of all relative file paths for a tiled scene.
// Used by the editor zipper to include tiles in ZIP export.
// ---------------------------------------------------------------------------
app.get('/api/tile/:sceneId/files', (req, res) => {
  const dir = path.join(TILES_DIR, req.params.sceneId);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Scene not found in workspace' });
  }

  const files = [];
  function walk(d, base) {
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry);
      const rel  = path.posix.join(base, entry);
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else files.push(rel);
    }
  }
  walk(dir, '');
  res.json({ files });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`panotour server  :${PORT}`);
  console.log(`  tiles    →  ${TILES_DIR}`);
  console.log(`  viewer   →  ${VIEWER_DIR}`);
});
