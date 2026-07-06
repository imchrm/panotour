'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const { execSync } = require('child_process');
const path = require('path');

const DEV_SERVER_URL = 'http://localhost:5173';

let mainWindow = null;

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

app.whenReady().then(() => {
  if (!checkNodeJs()) return;
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
