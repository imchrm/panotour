#!/usr/bin/env node
'use strict';

const minimist = require('minimist');
const path = require('path');
const fs = require('fs');
const { tileScene } = require('./lib/cubemapTiler');
const { computeLevels, computeMobileLevels, writeManifest } = require('./lib/manifest');

const argv = minimist(process.argv.slice(2), {
  string:  ['input', 'output', 'id'],
  boolean: ['mobile'],
  alias:   { i: 'input', o: 'output' },
});

function usage() {
  console.error('Usage: node tiler.js --input <path> --output <dir> --id <scene-id> [--mobile]');
  console.error('');
  console.error('Options:');
  console.error('  --input,  -i  Equirectangular JPEG or PNG source');
  console.error('  --output, -o  Output directory for tiles and manifest');
  console.error('  --id          Scene identifier (used in manifest.json)');
  console.error('  --mobile      Also generate mobile tiles in <output>/mobile/');
  console.error('                Mobile: faceSize ≤ 512px, tileSize = 256px');
  process.exit(1);
}

if (!argv.input || !argv.output || !argv.id) usage();

const inputPath = path.resolve(argv.input);
const outputDir = path.resolve(argv.output);
const sceneId   = argv.id;
const withMobile = !!argv.mobile;

if (!fs.existsSync(inputPath)) {
  console.error(`Error: input file not found: ${inputPath}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

async function main() {
  const sharp = require('sharp');

  const meta = await sharp(inputPath).metadata();
  if (!meta.width || !meta.height) {
    console.error('Error: could not read image dimensions');
    process.exit(1);
  }

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

  console.log(`Input  : ${inputPath}  (${meta.width}x${meta.height})`);
  console.log(`Output : ${outputDir}`);
  console.log(`Desktop: faceSize=${faceSize}px, ${levels.length} level(s)`);
  if (withMobile) {
    const m = targets[1];
    console.log(`Mobile : faceSize=${m.faceSize}px, ${m.levels.length} level(s)  → ${m.outputDir}`);
  }
  console.log('');

  const LINE_WIDTH = 55;

  await tileScene(inputPath, targets, (msg) => {
    process.stdout.write(`\r${msg.padEnd(LINE_WIDTH)}`);
  });

  writeManifest(outputDir, sceneId, levels);
  if (withMobile) {
    const m = targets[1];
    writeManifest(m.outputDir, sceneId, m.levels);
  }

  process.stdout.write('\r' + ' '.repeat(LINE_WIDTH) + '\r');
  console.log('Done.');
  console.log(`  Desktop tiles   : ${outputDir}/`);
  console.log(`  Desktop manifest: ${path.join(outputDir, 'manifest.json')}`);
  if (withMobile) {
    const mobileDir = targets[1].outputDir;
    console.log(`  Mobile tiles    : ${mobileDir}/`);
    console.log(`  Mobile manifest : ${path.join(mobileDir, 'manifest.json')}`);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
