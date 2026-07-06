'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { execSync } = require('child_process');
const path = require('path');

const { createProject, openProject, saveProject } = require('./project');

const DEV_SERVER_URL = 'http://localhost:5173';

let mainWindow  = null;
let projectPath = null;

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

  ipcMain.handle('project:save', async (_event, data) => {
    if (!projectPath) {
      throw new Error('No project is open');
    }
    saveProject(projectPath, data);
    return { projectPath };
  });
}

app.whenReady().then(() => {
  if (!checkNodeJs()) return;
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
