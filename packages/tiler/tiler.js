#!/usr/bin/env node
'use strict';

const minimist = require('minimist');
const path = require('path');
const fs = require('fs');
const { tileScene } = require('./lib/cubemapTiler');
const { computeLevels, writeManifest } = require('./lib/manifest');

const argv = minimist(process.argv.slice(2), {
  string: ['input', 'output', 'id'],
  alias: { i: 'input', o: 'output' },
});

function usage() {
  console.error('Usage: node tiler.js --input <path> --output <dir> --id <scene-id>');
  console.error('');
  console.error('Options:');
  console.error('  --input,  -i  Equirectangular JPEG or PNG source');
  console.error('  --output, -o  Output directory for tiles and manifest');
  console.error('  --id          Scene identifier (used in manifest.json)');
  process.exit(1);
}

if (!argv.input || !argv.output || !argv.id) usage();

const inputPath = path.resolve(argv.input);
const outputDir = path.resolve(argv.output);
const sceneId   = argv.id;

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

  console.log(`Input : ${inputPath}  (${meta.width}x${meta.height})`);
  console.log(`Output: ${outputDir}`);
  console.log(`Faces : ${faceSize}px,  ${levels.length} level(s)`);
  console.log('');

  const LINE_WIDTH = 50;

  await tileScene(inputPath, outputDir, sceneId, faceSize, levels, (msg) => {
    process.stdout.write(`\r${msg.padEnd(LINE_WIDTH)}`);
  });

  writeManifest(outputDir, sceneId, levels);

  process.stdout.write('\r' + ' '.repeat(LINE_WIDTH) + '\r');
  console.log(`Done.`);
  console.log(`  Tiles   : ${outputDir}/`);
  console.log(`  Manifest: ${path.join(outputDir, 'manifest.json')}`);
  console.log(`  Preview : ${path.join(outputDir, 'preview.jpg')}`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
