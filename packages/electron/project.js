'use strict';

const path = require('path');
const fs   = require('fs');

const PROJECT_FILE = 'project.json';
const SUBDIRS = ['scenes', 'tiles', 'media'];

function createProject(projectDir, name) {
  if (fs.existsSync(path.join(projectDir, PROJECT_FILE))) {
    throw new Error(`Project already exists: ${projectDir}`);
  }
  fs.mkdirSync(projectDir, { recursive: true });
  for (const sub of SUBDIRS) {
    fs.mkdirSync(path.join(projectDir, sub), { recursive: true });
  }
  const data = {
    schemaVersion: '1.0',
    name: name || path.basename(projectDir),
    createdAt: new Date().toISOString(),
    defaultLang: 'ru',
    defaultSceneId: null,
    autorotate: { enabled: false, speed: 0.5 },
    scenes: [],
  };
  writeProjectFile(projectDir, data);
  return data;
}

function openProject(projectDir) {
  const file = path.join(projectDir, PROJECT_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`Not a panotour project (missing ${PROJECT_FILE}): ${projectDir}`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.schemaVersion !== '1.0') {
    throw new Error(`Unsupported project schemaVersion: ${data.schemaVersion}`);
  }
  return data;
}

function saveProject(projectDir, data) {
  requireProject(projectDir);
  writeProjectFile(projectDir, data);
}

function addSceneFile(projectDir, sceneId, srcPath) {
  requireProject(projectDir);
  validateSceneId(sceneId);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  const scenesDir = path.join(projectDir, 'scenes');
  fs.mkdirSync(scenesDir, { recursive: true });
  const destFile = path.join(scenesDir, `${sceneId}.jpg`);
  fs.copyFileSync(srcPath, destFile);
  return { sceneId, sourceFile: `scenes/${sceneId}.jpg`, originalPath: srcPath };
}

function deleteSceneFiles(projectDir, sceneId) {
  requireProject(projectDir);
  validateSceneId(sceneId);
  fs.rmSync(path.join(projectDir, 'scenes', `${sceneId}.jpg`), { force: true });
  fs.rmSync(path.join(projectDir, 'tiles', sceneId), { recursive: true, force: true });
  return listSceneIds(projectDir);
}

function readSceneFile(projectDir, sceneId) {
  requireProject(projectDir);
  validateSceneId(sceneId);
  const file = path.join(projectDir, 'scenes', `${sceneId}.jpg`);
  if (!fs.existsSync(file)) {
    throw new Error(`Panorama not found: ${file}`);
  }
  return fs.readFileSync(file);
}

function listSceneIds(projectDir) {
  const scenesDir = path.join(projectDir, 'scenes');
  if (!fs.existsSync(scenesDir)) return [];
  return fs.readdirSync(scenesDir)
    .filter((f) => f.toLowerCase().endsWith('.jpg'))
    .map((f) => f.slice(0, -4))
    .sort();
}

function validateSceneId(sceneId) {
  if (typeof sceneId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(sceneId)) {
    throw new Error(`Invalid scene id: ${sceneId}`);
  }
}

function requireProject(projectDir) {
  if (!fs.existsSync(path.join(projectDir, PROJECT_FILE))) {
    throw new Error(`Not a panotour project: ${projectDir}`);
  }
}

function updateSceneTiling(projectDir, sceneId, tileResult) {
  requireProject(projectDir);
  validateSceneId(sceneId);
  const data = openProject(projectDir);
  let scene = data.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    scene = { id: sceneId, sourceFile: `scenes/${sceneId}.jpg`, hotspots: [] };
    data.scenes.push(scene);
  }
  scene.tilesPath   = tileResult.tilesPath;
  scene.previewUrl  = tileResult.previewUrl;
  scene.levels      = tileResult.levels;
  scene.sourceHash  = tileResult.sourceHash;
  scene.tiledAt     = tileResult.tiledAt;
  if (tileResult.mobileLevels) scene.mobileLevels = tileResult.mobileLevels;
  writeProjectFile(projectDir, data);
  return scene;
}

function writeProjectFile(projectDir, data) {
  fs.writeFileSync(
    path.join(projectDir, PROJECT_FILE),
    JSON.stringify(data, null, 2) + '\n',
    'utf8',
  );
}

module.exports = {
  createProject,
  openProject,
  saveProject,
  addSceneFile,
  deleteSceneFiles,
  readSceneFile,
  listSceneIds,
  updateSceneTiling,
  validateSceneId,
  PROJECT_FILE,
};
