'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  ping: () => 'pong',
});
