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
  if (!fs.existsSync(path.join(projectDir, PROJECT_FILE))) {
    throw new Error(`Not a panotour project: ${projectDir}`);
  }
  writeProjectFile(projectDir, data);
}

function writeProjectFile(projectDir, data) {
  fs.writeFileSync(
    path.join(projectDir, PROJECT_FILE),
    JSON.stringify(data, null, 2) + '\n',
    'utf8',
  );
}

module.exports = { createProject, openProject, saveProject, PROJECT_FILE };
