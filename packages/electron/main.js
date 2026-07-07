'use strict';

const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const os = require('os');

const {
  createProject,
  openProject,
  saveProject,
  addSceneFile,
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

const DEV_SERVER_URL = 'http://localhost:5173';

if (process.env.PANOTOUR_SOFTWARE_GL === '1') {
  app.disableHardwareAcceleration();
}

let mainWindow    = null;
let projectPath   = null;
let previewWindow = null;
let previewDir    = null;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.on('did-fail-load', () => {
      mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('project:create', async (_event, opts = {}) => {
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

  ipcMain.handle('project:open', async (_event, opts = {}) => {
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

  ipcMain.handle('project:current', async () => {
    if (!projectPath) return null;
    return { projectPath, project: openProject(projectPath) };
  });

  ipcMain.handle('project:save', async (_event, data) => {
    requireOpenProject();
    saveProject(projectPath, data);
    return { projectPath };
  });

  ipcMain.handle('scene:add', async (_event, sceneId, srcPath) => {
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

  ipcMain.handle('scene:read', async (_event, sceneId) => {
    requireOpenProject();
    return readSceneFile(projectPath, sceneId);
  });

  ipcMain.handle('scene:delete', async (_event, sceneId) => {
    requireOpenProject();
    const scenes = deleteSceneFiles(projectPath, sceneId);
    return { scenes };
  });

  ipcMain.handle('tile:run', async (event, sceneId) => {
    requireOpenProject();
    return tileOne(event.sender, sceneId);
  });

  ipcMain.handle('preview:open', async (_event, tourJson, opts = {}) => {
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
      previewWindow.loadURL(url);
      previewWindow.on('closed', () => {
        previewWindow = null;
      });
    }
    return { previewDir };
  });

  ipcMain.handle('export:folder', async (_event, tourJson, opts = {}) => {
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

  ipcMain.handle('export:zip', async (_event, tourJson, opts = {}) => {
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

  ipcMain.handle('tile:runAll', async (event, sceneIds) => {
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

app.whenReady().then(() => {
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
