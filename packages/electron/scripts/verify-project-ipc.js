'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const { fork } = require('child_process');

const electronPkg = path.join(__dirname, '..');
const mainPath = path.join(electronPkg, 'main.js');

function makeStub(workDir, dialogCalls, handlers, state) {
  class FakeWebContents {
    on() {}
    openDevTools() {}
    send() {}
  }
  class FakeBrowserWindow {
    constructor() {
      state.windowCreated = true;
      this.webContents = new FakeWebContents();
    }
    loadURL() {}
    loadFile() {}
    on() {}
    focus() {}
    maximize() {}
    isMaximized() { return false; }
    getBounds() { return { x: 0, y: 0, width: 1400, height: 900 }; }
    getNormalBounds() { return this.getBounds(); }
    isDestroyed() { return false; }
    static getAllWindows() { return []; }
  }
  return {
    app: {
      isPackaged: false,
      whenReady: () => Promise.resolve(),
      on: () => {},
      quit: () => { state.quitCalled = true; },
      getPath: () => path.join(workDir, 'userData'),
      getAppPath: () => electronPkg,
      getAppMetrics: () => [],
      disableHardwareAcceleration: () => {},
    },
    BrowserWindow: FakeBrowserWindow,
    ipcMain: {
      handle: (channel, fn) => handlers.set(channel, fn),
      on: () => {},
    },
    dialog: {
      showMessageBoxSync: (opts) => { dialogCalls.push(opts); return 0; },
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true }),
    },
    protocol: {
      registerSchemesAsPrivileged: () => {},
      handle: () => {},
    },
    net: {},
    shell: { openPath: () => {}, showItemInFolder: () => {} },
    screen: { getAllDisplays: () => [] },
  };
}

function installStub(stub) {
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'electron') return stub;
    return origLoad.call(this, request, ...rest);
  };
}

async function runProjectChecks() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panotour-verify-'));
  const handlers = new Map();
  const dialogCalls = [];
  const state = { quitCalled: false, windowCreated: false };
  installStub(makeStub(workDir, dialogCalls, handlers, state));

  require(mainPath);
  await new Promise((r) => setImmediate(r));

  const invoke = (channel, ...args) => {
    const fn = handlers.get(channel);
    assert(fn, `no handler for ${channel}`);
    return fn({ sender: { send: () => {} } }, ...args);
  };

  const expected = [
    'project:create', 'project:open', 'project:save', 'project:current',
    'scene:add', 'scene:read', 'scene:delete',
    'tile:run', 'tile:runAll', 'preview:open',
    'export:folder', 'export:zip',
  ];
  for (const ch of expected) assert(handlers.has(ch), `missing handler ${ch}`);
  assert.strictEqual(state.windowCreated, true, 'main window was not created');
  assert.strictEqual(dialogCalls.length, 0, 'unexpected startup dialog');
  console.log('startup OK: node check passed, window created, handlers: ' + [...handlers.keys()].sort().join(', '));

  const projDir = path.join(workDir, 'my-tour');
  const created = await invoke('project:create', { dirPath: projDir, name: 'Test Tour' });
  assert.strictEqual(created.canceled, false);
  assert.strictEqual(created.projectPath, projDir);
  for (const sub of ['scenes', 'tiles', 'media']) {
    assert(fs.statSync(path.join(projDir, sub)).isDirectory(), `missing dir ${sub}`);
  }
  const onDisk = JSON.parse(fs.readFileSync(path.join(projDir, 'project.json'), 'utf8'));
  assert.strictEqual(onDisk.schemaVersion, '1.0');
  assert.strictEqual(onDisk.name, 'Test Tour');
  assert.deepStrictEqual(onDisk.scenes, []);
  console.log('project:create OK: ' + fs.readdirSync(projDir).sort().join(', '));

  await assert.rejects(() => invoke('project:create', { dirPath: projDir }), /already exists/);
  console.log('project:create duplicate rejected OK');

  onDisk.defaultSceneId = 'scene-01';
  onDisk.scenes.push({ id: 'scene-01', title: 'Test', hotspots: [] });
  await invoke('project:save', onDisk);
  const saved = JSON.parse(fs.readFileSync(path.join(projDir, 'project.json'), 'utf8'));
  assert.strictEqual(saved.defaultSceneId, 'scene-01');
  assert.strictEqual(saved.scenes.length, 1);
  console.log('project:save OK');

  const opened = await invoke('project:open', { dirPath: projDir });
  assert.strictEqual(opened.canceled, false);
  assert.strictEqual(opened.project.scenes[0].id, 'scene-01');
  console.log('project:open OK');

  const current = await invoke('project:current');
  assert.strictEqual(current.projectPath, projDir);
  console.log('project:current OK');

  await assert.rejects(
    () => invoke('project:open', { dirPath: path.join(workDir, 'not-a-project') }),
    /Not a panotour project/,
  );
  console.log('project:open invalid dir rejected OK');
}

async function runNodeMissingCheck() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'panotour-nodecheck-'));
  const handlers = new Map();
  const dialogCalls = [];
  const state = { quitCalled: false, windowCreated: false };
  installStub(makeStub(workDir, dialogCalls, handlers, state));

  process.env.PATH = path.join(workDir, 'empty-path');
  require(mainPath);
  await new Promise((r) => setImmediate(r));

  assert.strictEqual(dialogCalls.length, 1, 'error dialog was not shown');
  assert.match(dialogCalls[0].title, /Node\.js/);
  assert.strictEqual(state.quitCalled, true, 'app.quit was not called');
  assert.strictEqual(state.windowCreated, false, 'window created despite missing node');
  console.log('node-missing OK: dialog shown, app.quit called, no window');
}

async function main() {
  if (process.env.PANOTOUR_VERIFY_MODE === 'node-missing') {
    await runNodeMissingCheck();
    return;
  }
  await runProjectChecks();
  await new Promise((resolve, reject) => {
    const child = fork(__filename, {
      env: { ...process.env, PANOTOUR_VERIFY_MODE: 'node-missing' },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`node-missing check failed with code ${code}`));
    });
  });
  console.log('ALL CHECKS PASSED');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED: ' + err.message);
    process.exit(1);
  });
