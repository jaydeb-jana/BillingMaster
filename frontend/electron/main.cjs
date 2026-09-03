const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const url = require('url');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1' || !app.isPackaged;
const devServerUrl = process.env.DEV_SERVER_URL || 'http://localhost:3000';

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1366,
      height: 850,
      minWidth: 1024,
      minHeight: 680,
      title: 'BillingMaster',
      frame: false, // Frameless for modern custom titlebar
      backgroundColor: '#09090b', // Matches dark theme background
      show: false, // Ready-to-show pattern to prevent white flicker
      icon: path.join(__dirname, 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
        webSecurity: true,
      },
    });

    // Custom Application Menu (Shortcuts)
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Print Receipt / Invoice',
            accelerator: 'CmdOrCtrl+P',
            click: () => {
              if (mainWindow) mainWindow.webContents.print();
            },
          },
          { type: 'separator' },
          {
            label: 'Exit BillingMaster',
            accelerator: 'CmdOrCtrl+Q',
            click: () => app.quit(),
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload', accelerator: 'CmdOrCtrl+R' },
          { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
          {
            label: 'Toggle Developer Tools',
            accelerator: 'F12',
            click: () => {
              if (mainWindow) mainWindow.webContents.toggleDevTools();
            },
          },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen', accelerator: 'F11' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation & Support',
            click: () => shell.openExternal('https://billingmaster.app'),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Load content
    if (isDev && !app.isPackaged) {
      mainWindow.loadURL(devServerUrl).catch((err) => {
        console.warn('Failed to load dev server, falling back to dist...', err.message);
        loadLocalDist();
      });
    } else {
      loadLocalDist();
    }

    function loadLocalDist() {
      const distPublicPath = path.join(__dirname, '../dist/public/index.html');
      const distPath = path.join(__dirname, '../dist/index.html');
      const fs = require('fs');

      if (fs.existsSync(distPublicPath)) {
        mainWindow.loadFile(distPublicPath);
      } else if (fs.existsSync(distPath)) {
        mainWindow.loadFile(distPath);
      } else {
        mainWindow.loadURL(
          url.format({
            pathname: path.join(__dirname, '../dist/public/index.html'),
            protocol: 'file:',
            slashes: true,
          })
        );
      }
    }

    // Graceful display once rendered
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Notify renderer on maximize / unmaximize
    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('window:state-change', { isMaximized: true });
    });
    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('window:state-change', { isMaximized: false });
    });

    // Open external links safely in OS default browser
    mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (targetUrl.startsWith('http:') || targetUrl.startsWith('https:') || targetUrl.startsWith('mailto:')) {
        shell.openExternal(targetUrl);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    // Setup IPC Handlers
    ipcMain.handle('window:minimize', () => {
      if (mainWindow) mainWindow.minimize();
      return true;
    });

    ipcMain.handle('window:maximize', () => {
      if (!mainWindow) return false;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return false;
      } else {
        mainWindow.maximize();
        return true;
      }
    });

    ipcMain.handle('window:close', () => {
      if (mainWindow) mainWindow.close();
      return true;
    });

    ipcMain.handle('window:isMaximized', () => {
      return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.handle('app:print', async (_event, options = {}) => {
      if (!mainWindow) return false;
      return new Promise((resolve) => {
        mainWindow.webContents.print(
          {
            silent: options.silent || false,
            printBackground: options.printBackground ?? true,
            deviceName: options.deviceName || '',
            pageSize: options.pageSize || 'A4',
            margins: {
              marginType: 'none',
            },
          },
          (success, failureReason) => {
            if (!success) {
              console.warn('Print failed:', failureReason);
              resolve({ success: false, error: failureReason });
            } else {
              resolve({ success: true });
            }
          }
        );
      });
    });

    ipcMain.handle('app:printToPDF', async (_event, options = {}) => {
      if (!mainWindow) return null;
      try {
        const data = await mainWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: options.pageSize || 'A4',
          landscape: options.landscape || false,
        });
        return data;
      } catch (error) {
        console.error('PDF Generation failed:', error);
        throw error;
      }
    });

    ipcMain.handle('app:openExternal', async (_event, targetUrl) => {
      if (targetUrl) {
        await shell.openExternal(targetUrl);
        return true;
      }
      return false;
    });

    ipcMain.handle('app:getInfo', () => {
      return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform,
        isPackaged: app.isPackaged,
      };
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
