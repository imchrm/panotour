'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  ping: () => 'pong',
  createProject: (opts) => ipcRenderer.invoke('project:create', opts),
  openProject:   (opts) => ipcRenderer.invoke('project:open', opts),
  saveProject:   (data) => ipcRenderer.invoke('project:save', data),
  currentProject: ()    => ipcRenderer.invoke('project:current'),
  addScene:      (sceneId, srcPath) => ipcRenderer.invoke('scene:add', sceneId, srcPath),
  deleteScene:   (sceneId)          => ipcRenderer.invoke('scene:delete', sceneId),
  readScene:     (sceneId)          => ipcRenderer.invoke('scene:read', sceneId),
  tileScene:     (sceneId, onProgress) => {
    const channel = `tile:progress:${sceneId}`;
    const listener = (_event, progress) => onProgress(progress);
    if (onProgress) ipcRenderer.on(channel, listener);
    return ipcRenderer.invoke('tile:run', sceneId).finally(() => {
      if (onProgress) ipcRenderer.removeListener(channel, listener);
    });
  },
  tileAll:       (sceneIds) => ipcRenderer.invoke('tile:runAll', sceneIds),
  openPreview:   (tourJson, opts) => ipcRenderer.invoke('preview:open', tourJson, opts),
  exportFolder:  (tourJson, opts) => ipcRenderer.invoke('export:folder', tourJson, opts),
  exportZip:     (tourJson, opts) => ipcRenderer.invoke('export:zip', tourJson, opts),
});
