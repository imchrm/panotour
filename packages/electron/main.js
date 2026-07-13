'use strict';

const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, screen } = require('electron');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const os = require('os');

const {
  createProject,
  openProject,
  saveProject,
  addSceneFile,
  copyMediaFile,
  deleteSceneFiles,
  readSceneFile,
  updateSceneTiling,
  validateSceneId,
} = require('./project');
const { resolveTilerPath, runTiler, runPool } = require('./tiling');
const {
  PREVIEW_SCHEME,
  writePreviewTour,
  resolveViewerDir,
  resolvePreviewFile,
} = require('./preview');
const { exportToFolder, exportToZip } = require('./export');
const { loadWindowState, saveWindowState } = require('./window-state');
const log = require('./log');

const DEV_SERVER_URL = 'http://localhost:5173';

if (process.env.PANOTOUR_SOFTWARE_GL === '1') {
  app.disableHardwareAcceleration();
}

let mainWindow    = null;
let projectPath   = null;
let previewWindow = null;
let previewDir    = null;
let rendererDirty = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: PREVIEW_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function checkNodeJs() {
  try {
    execSync('node -e ""', { stdio: 'ignore' });
    return true;
  } catch {
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'Node.js не найден',
      message:
        'Для работы тайлера требуется Node.js.\n\n' +
        'Скачайте и установите Node.js LTS с nodejs.org, затем перезапустите приложение.',
      buttons: ['Закрыть'],
    });
    app.quit();
    return false;
  }
}

function wireWindowLogging(win, name) {
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const source = `${name}:console`;
    const text = `${message} (${sourceId}:${line})`;
    if (level >= 3) log.error(source, text);
    else if (level === 2) log.warn(source, text);
    else log.info(source, text);
  });
  win.webContents.on('unresponsive', () => log.error(name, 'window unresponsive'));
  win.webContents.on('responsive', () => log.info(name, 'window responsive again'));
}

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function createWindow() {
  const state = loadWindowState(windowStateFile(), screen.getAllDisplays());
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (state.maximized) mainWindow.maximize();
  mainWindow.on('close', (event) => {
    if (rendererDirty) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Unsaved changes',
        message: 'The project has unsaved changes.\n\nClose without saving?',
        buttons: ['Cancel', 'Close anyway'],
        defaultId: 0,
        cancelId: 0,
      });
      if (choice === 0) {
        event.preventDefault();
        return;
      }
    }
    if (mainWindow) saveWindowState(windowStateFile(), mainWindow);
  });
  wireWindowLogging(mainWindow, 'editor');

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.on('did-fail-load', () => {
      mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    });
  }

  if (!app.isPackaged || process.env.PANOTOUR_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    const started = Date.now();
    log.info('ipc', `-> ${channel}(${log.summarize(args)})`);
    try {
      const result = await fn(event, ...args);
      log.info('ipc', `<- ${channel} ok ${Date.now() - started}ms`);
      return result;
    } catch (err) {
      log.error('ipc', `<- ${channel} FAILED ${Date.now() - started}ms: ${err.message}`);
      throw err;
    }
  });
}

function registerIpcHandlers() {
  ipcMain.on('app:dirty', (_event, dirty) => {
    rendererDirty = !!dirty;
  });

  handle('project:create', async (_event, opts = {}) => {
    let dir = opts.dirPath;
    if (!dir) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Создать проект',
        buttonLabel: 'Создать',
        defaultPath: opts.name || 'my-tour',
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      dir = result.filePath;
    }
    const data = createProject(dir, opts.name);
    projectPath = dir;
    return { canceled: false, projectPath: dir, project: data };
  });

  handle('project:open', async (_event, opts = {}) => {
    let dir = opts.dirPath;
    if (!dir) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Открыть проект',
        buttonLabel: 'Открыть',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      dir = result.filePaths[0];
    }
    const data = openProject(dir);
    projectPath = dir;
    return { canceled: false, projectPath: dir, project: data };
  });

  handle('project:current', async () => {
    if (!projectPath) return null;
    return { projectPath, project: openProject(projectPath) };
  });

  handle('project:save', async (_event, data) => {
    requireOpenProject();
    saveProject(projectPath, data);
    return { projectPath };
  });

  handle('scene:add', async (_event, sceneId, srcPath) => {
    requireOpenProject();
    let src = srcPath;
    if (!src) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Добавить панораму',
        buttonLabel: 'Добавить',
        filters: [{ name: 'JPEG', extensions: ['jpg', 'jpeg'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      src = result.filePaths[0];
    }
    const scene = addSceneFile(projectPath, sceneId, src);
    return { canceled: false, ...scene };
  });

  handle('scene:read', async (_event, sceneId) => {
    requireOpenProject();
    return readSceneFile(projectPath, sceneId);
  });

  handle('scene:delete', async (_event, sceneId) => {
    requireOpenProject();
    const scenes = deleteSceneFiles(projectPath, sceneId);
    return { scenes };
  });

  handle('media:copy', async (_event, opts = {}) => {
    requireOpenProject();
    let src = opts.srcPath;
    if (!src) {
      const filters =
        opts.kind === 'video'
          ? [{ name: 'Video', extensions: ['mp4', 'webm'] }]
          : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }];
      const result = await dialog.showOpenDialog(mainWindow, {
        title: opts.kind === 'video' ? 'Выбрать видео' : 'Выбрать изображение',
        buttonLabel: 'Выбрать',
        filters,
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      src = result.filePaths[0];
    }
    const { mediaPath } = copyMediaFile(projectPath, src);
    return { canceled: false, mediaPath };
  });

  handle('tile:run', async (event, sceneId) => {
    requireOpenProject();
    return tileOne(event.sender, sceneId);
  });

  handle('preview:open', async (_event, tourJson, opts = {}) => {
    requireOpenProject();
    previewDir = writePreviewTour(tourJson);
    const query = opts.sceneId ? `?scene=${encodeURIComponent(opts.sceneId)}` : '';
    const url = `${PREVIEW_SCHEME}://preview/index.html${query}`;
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.loadURL(url);
      previewWindow.focus();
    } else {
      previewWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Panotour Preview',
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      wireWindowLogging(previewWindow, 'preview');
      previewWindow.loadURL(url);
      previewWindow.on('closed', () => {
        previewWindow = null;
      });
    }
    return { previewDir };
  });

  handle('export:folder', async (_event, tourJson, opts = {}) => {
    requireOpenProject();
    let dir = opts.dirPath;
    if (!dir) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Экспорт тура в папку',
        buttonLabel: 'Экспортировать',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };
      dir = result.filePaths[0];
    }
    exportToFolder(dir, exportRoots(), tourJson);
    shell.openPath(dir);
    return { canceled: false, exportPath: dir };
  });

  handle('export:zip', async (_event, tourJson, opts = {}) => {
    requireOpenProject();
    let file = opts.filePath;
    if (!file) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Экспорт тура в ZIP',
        buttonLabel: 'Сохранить',
        defaultPath: 'tour.zip',
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      file = result.filePath;
    }
    await exportToZip(file, exportRoots(), tourJson);
    shell.showItemInFolder(file);
    return { canceled: false, exportPath: file };
  });

  handle('tile:runAll', async (event, sceneIds) => {
    requireOpenProject();
    const concurrency = Math.max(1, os.cpus().length - 1);
    return runPool(sceneIds, concurrency, (sceneId) =>
      tileOne(event.sender, sceneId)
        .then((result) => ({ ok: true, ...result }))
        .catch((err) => ({ ok: false, sceneId, error: err.message })),
    );
  });
}

async function tileOne(sender, sceneId) {
  validateSceneId(sceneId);
  const tilerPath = resolveTilerPath(app.getAppPath(), process.execPath);
  const result = await runTiler(tilerPath, projectPath, sceneId, (progress) => {
    sender.send(`tile:progress:${sceneId}`, progress);
  });
  updateSceneTiling(projectPath, sceneId, result);
  return result;
}

function exportRoots() {
  return {
    projectDir: projectPath,
    viewerDir: resolveViewerDir(app.getAppPath(), process.execPath),
  };
}

function requireOpenProject() {
  if (!projectPath) {
    throw new Error('No project is open');
  }
}

function registerPreviewProtocol() {
  protocol.handle(PREVIEW_SCHEME, (request) => {
    let pathname;
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (!previewDir || !projectPath) {
      return new Response('No preview', { status: 404 });
    }
    const file = resolvePreviewFile(pathname, {
      previewDir,
      projectDir: projectPath,
      viewerDir: resolveViewerDir(app.getAppPath(), process.execPath),
    });
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.on('render-process-gone', (_event, _webContents, details) => {
  log.error('app', `render-process-gone: ${JSON.stringify(details)}`);
});

app.on('child-process-gone', (_event, details) => {
  log.error('app', `child-process-gone: ${JSON.stringify(details)}`);
});

process.on('uncaughtException', (err) => {
  log.error('main', `uncaughtException: ${err.stack ?? err.message}`);
});

process.on('unhandledRejection', (reason) => {
  log.error('main', `unhandledRejection: ${reason}`);
});

app.whenReady().then(() => {
  const logFile = log.init(path.join(app.getPath('userData'), 'logs'));
  log.info('app', `started pid=${process.pid} electron=${process.versions.electron} packaged=${app.isPackaged}`);
  log.info('app', `log file: ${logFile}`);
  log.startMetrics(app);
  if (!checkNodeJs()) return;
  registerPreviewProtocol();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
