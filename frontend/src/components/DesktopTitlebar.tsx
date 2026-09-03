import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Server, Wifi, WifiOff } from 'lucide-react';

export function DesktopTitlebar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
      setIsElectron(true);

      // Check initial maximized state
      window.electronAPI.isMaximized().then((max) => setIsMaximized(max));

      // Listen for window state changes
      const unsubscribe = window.electronAPI.onWindowStateChange((state) => {
        setIsMaximized(state.isMaximized);
      });

      // Quick health check to backend
      const checkBackend = async () => {
        try {
          const res = await fetch('http://localhost:5000/api/health', { method: 'GET', credentials: 'omit' }).catch(() => null);
          setServerOnline(res ? res.ok : false);
        } catch {
          setServerOnline(false);
        }
      };

      checkBackend();
      const interval = setInterval(checkBackend, 15000);

      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }
  }, []);

  if (!isElectron) {
    return null;
  }

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <div
      className="sticky top-0 z-50 flex h-9 w-full select-none items-center justify-between border-b border-border/40 bg-background/95 px-3 backdrop-blur-md"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Brand & Left Info */}
      <div
        className="flex items-center gap-2.5 text-xs"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground font-bold shadow-xs text-[10px]">
          BM
        </div>
        <span className="font-semibold text-foreground tracking-tight">BillingMaster</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
          Desktop
        </span>

        {/* Server Status Indicator */}
        <div
          className="ml-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/80"
          title={serverOnline === true ? 'Backend Server Connected (localhost:5000)' : serverOnline === false ? 'Backend Server Disconnected' : 'Checking server...'}
        >
          {serverOnline === true ? (
            <span className="flex items-center gap-1 text-emerald-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Server className="h-3 w-3" />
              <span className="hidden md:inline text-[10px]">Server Online</span>
            </span>
          ) : serverOnline === false ? (
            <span className="flex items-center gap-1 text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <WifiOff className="h-3 w-3" />
              <span className="hidden md:inline text-[10px]">Server Offline</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wifi className="h-3 w-3 animate-pulse" />
            </span>
          )}
        </div>
      </div>

      {/* Center Draggable Area */}
      <div className="flex-1 h-full" />

      {/* Window Control Buttons */}
      <div
        className="flex items-center -mr-3"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          type="button"
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:bg-muted"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          type="button"
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:bg-muted"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy className="h-3 w-3 rotate-180" />
          ) : (
            <Square className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleClose}
          type="button"
          className="flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground active:bg-destructive/90"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
