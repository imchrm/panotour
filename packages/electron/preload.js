'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  ping: () => 'pong',
  createProject: (opts) => ipcRenderer.invoke('project:create', opts),
  openProject:   (opts) => ipcRenderer.invoke('project:open', opts),
  saveProject:   (data) => ipcRenderer.invoke('project:save', data),
  addScene:      (sceneId, srcPath) => ipcRenderer.invoke('scene:add', sceneId, srcPath),
  deleteScene:   (sceneId)          => ipcRenderer.invoke('scene:delete', sceneId),
});
