'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const tilerSrc = path.join(__dirname, '..', '..', 'tiler');
const stageDir = path.join(__dirname, '..', 'stage', 'tiler');

fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const entry of ['tiler.js', 'lib', 'package.json']) {
  fs.cpSync(path.join(tilerSrc, entry), path.join(stageDir, entry), { recursive: true });
}

execSync('npm install --omit=dev --no-audit --no-fund --workspaces=false', {
  cwd: stageDir,
  stdio: 'inherit',
});

console.log(`Tiler staged at ${stageDir}`);
