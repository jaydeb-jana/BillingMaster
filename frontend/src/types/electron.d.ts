export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  minimize: () => Promise<boolean>;
  maximize: () => Promise<boolean>;
  close: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  print: (options?: { silent?: boolean; printBackground?: boolean; deviceName?: string; pageSize?: string }) => Promise<{ success: boolean; error?: string }>;
  printToPDF: (options?: { pageSize?: string; landscape?: boolean }) => Promise<Uint8Array>;
  openExternal: (url: string) => Promise<boolean>;
  getAppInfo: () => Promise<{ name: string; version: string; platform: string; isPackaged: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
