const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  isDesktop: true,
  readSave: () => ipcRenderer.invoke('save:read'),
  writeSave: (data) => ipcRenderer.invoke('save:write', data),
  savePath: () => ipcRenderer.invoke('save:path'),
  setFullscreen: (on) => ipcRenderer.invoke('app:fullscreen', on),
  quit: () => ipcRenderer.invoke('app:quit'),
  updateInfo: () => ipcRenderer.invoke('update:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: (onProgress) => {
    const h = (_e, p) => onProgress && onProgress(p);
    ipcRenderer.on('update:progress', h);
    return ipcRenderer.invoke('update:download').finally(() => ipcRenderer.removeListener('update:progress', h));
  },
  restartForUpdate: () => ipcRenderer.invoke('update:restart'),
  testShot: (name) => ipcRenderer.invoke('test:shot', name),
  testInput: (evts) => ipcRenderer.invoke('test:input', evts),
});
