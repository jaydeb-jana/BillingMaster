const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  
  // Window State Listener
  onWindowStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('window:state-change', handler);
    return () => {
      ipcRenderer.removeListener('window:state-change', handler);
    };
  },

  // Printing & Hardware
  print: (options) => ipcRenderer.invoke('app:print', options),
  printToPDF: (options) => ipcRenderer.invoke('app:printToPDF', options),

  // OS Integration
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
});
