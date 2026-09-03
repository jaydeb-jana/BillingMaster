import { useState } from 'react';
import { Globe, Monitor, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Server, Save, RotateCcw, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, setApiBaseUrl } from '@/lib/api';
import { getPlatformName, getPlatformDisplayLabel, isCapacitor } from '@/lib/platform';
import { mobileService } from '@/services/mobileService';

export function ServerPlatformSection() {
  const currentPlatform = getPlatformName();
  const platformLabel = getPlatformDisplayLabel();
  const isNative = isCapacitor();

  const [apiUrl, setApiUrl] = useState(() => getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      toast.error('Please enter a valid server URL');
      return;
    }

    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const cleanUrl = apiUrl.trim().replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        await mobileService.triggerHaptic('success');
        setTestResult({
          success: true,
          message: `Server connected successfully! Responded with HTTP ${res.status}.`,
          latency,
        });
        toast.success(`Server online (${latency}ms)`);
      } else {
        await mobileService.triggerHaptic('warning');
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}. Please check server status.`,
          latency,
        });
        toast.warning(`Server error: HTTP ${res.status}`);
      }
    } catch (err: any) {
      await mobileService.triggerHaptic('error');
      const isAbort = err.name === 'AbortError';
      const msg = isAbort
        ? 'Connection timed out after 6 seconds. Check IP and port.'
        : 'Could not connect to server. Ensure backend is running and reachable.';
      setTestResult({
        success: false,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = apiUrl.trim().replace(/\/$/, '');
    if (!trimmed) {
      toast.error('URL cannot be empty');
      return;
    }
    setApiBaseUrl(trimmed);
    mobileService.triggerHaptic('success');
    toast.success('Server URL saved successfully.');
  };

  const handleReset = () => {
    setApiBaseUrl(null);
    const def = ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5000').replace(/\/$/, '');
    setApiUrl(def);
    setTestResult(null);
    mobileService.triggerHaptic('light');
    toast.info('Server URL reset to default');
  };

  return (
    <div className="space-y-6">
      {/* Platform Detection Information Card */}
      <div className="card-shell p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-border/70 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              {currentPlatform === 'electron' ? (
                <Monitor size={20} />
              ) : currentPlatform === 'android' || currentPlatform === 'ios' ? (
                <Smartphone size={20} />
              ) : (
                <Globe size={20} />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">Cross-Platform Status</h3>
              <p className="text-xs text-muted-foreground">Operating environment and native device bridges</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-black text-primary">
            {platformLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/70 bg-card p-3.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Environment</div>
            <div className="mt-1 text-sm font-black text-foreground">{platformLabel}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Unified codebase for Web, Desktop & Mobile</div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-3.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Capacitor Engine</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-black">
              {isNative ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={15} /> Native Active
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Cpu size={15} /> Web Container
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {isNative ? 'Full hardware back-button & status-bar integration' : 'Ready for Capacitor native wrapper'}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-3.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Architecture</div>
            <div className="mt-1 text-sm font-black text-foreground">Decoupled REST Client</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Backend server runs standalone</div>
          </div>
        </div>
      </div>

      {/* Backend Server Connection Settings Card */}
      <div className="card-shell p-5 sm:p-7">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4 mb-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Server size={20} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">Backend API Server Endpoint</h3>
            <p className="text-xs text-muted-foreground">
              Configure which Node.js + MySQL server this app connects to
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-bold">Mobile Tip:</strong> On real mobile devices or Android emulators,{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">localhost</code> points to the phone itself.
            To connect to your computer during development, enter your local Wi-Fi IP address (for example:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-bold text-primary">http://192.168.1.100:5000</code>).
            For production, enter your deployed API domain.
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              API Base URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:5000 or https://api.yourdomain.com"
                className="input-shell flex-1 px-3.5 text-xs font-mono"
                data-testid="input-api-url"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn-secondary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs whitespace-nowrap"
                  data-testid="button-test-server-connection"
                >
                  <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
                  <span>{testing ? 'Testing…' : 'Test Connection'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs whitespace-nowrap"
                  data-testid="button-save-server-url"
                >
                  <Save size={14} />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Reset to default"
                  data-testid="button-reset-server-url"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Test Connection Output Feedback */}
          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-xl p-3.5 text-xs font-semibold ${
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{testResult.message}</p>
                {testResult.latency !== undefined && (
                  <p className="mt-0.5 text-[11px] opacity-80">Response time: {testResult.latency} ms</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
