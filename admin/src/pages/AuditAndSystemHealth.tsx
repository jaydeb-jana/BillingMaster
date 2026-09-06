import React from 'react';
import { ShieldCheck, Database, Cpu, Activity, Clock, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export interface AuditLog {
  id: string;
  action: string;
  target_entity: string;
  details: string;
  performed_by: string;
  created_at: string;
}

interface AuditProps {
  logs: AuditLog[];
  uptimeSeconds: number;
  databaseEngine: string;
  onTriggerMaintenance: () => Promise<void>;
}

export const AuditAndSystemHealth: React.FC<AuditProps> = ({
  logs,
  uptimeSeconds,
  databaseEngine,
  onTriggerMaintenance,
}) => {
  const formatUptime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hrs}h ${mins}m ${secs % 60}s`;
  };

  const handleMaintenanceClick = async () => {
    toast.loading('Running database index optimization...');
    try {
      await onTriggerMaintenance();
      toast.dismiss();
      toast.success('Database table indexing completed successfully!');
    } catch (err: any) {
      toast.dismiss();
      toast.error('Maintenance trigger failed');
    }
  };

  return (
    <div className="space-y-8">
      {/* Infrastructure Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-extrabold uppercase tracking-wider">
            <span>Server Process Uptime</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white font-mono tracking-tight">{formatUptime(uptimeSeconds)}</p>
            <p className="text-xs text-neutral-400 font-medium mt-1">Node.js Express Server on Port 5000</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-extrabold uppercase tracking-wider">
            <span>Database Storage Engine</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-extrabold text-white leading-snug">{databaseEngine}</p>
            <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Pool connection active (10 limits)
            </p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-extrabold uppercase tracking-wider">
            <span>Database Governance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={handleMaintenanceClick}
            className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-orange-400 font-extrabold text-xs border border-neutral-700/80 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Trigger DB Maintenance</span>
          </button>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="rounded-2xl bg-neutral-900/80 border border-neutral-800 p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
              Administrative Audit Log Trail
            </h3>
            <p className="text-xs text-neutral-400 mt-1 font-medium">
              Immutable record of system configuration changes, plan updates, and governance actions.
            </p>
          </div>
          <span className="text-xs font-mono font-extrabold px-3 py-1 bg-neutral-950 text-neutral-300 rounded-lg border border-neutral-800 shrink-0">
            {logs.length} {logs.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-8">No audit log entries recorded yet.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-neutral-700/80 transition-all"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[11px] uppercase tracking-wider whitespace-nowrap shrink-0">
                      {log.action}
                    </span>
                    <span className="font-extrabold text-sm text-white truncate">{log.target_entity}</span>
                  </div>
                  <p className="text-xs text-neutral-300 font-medium leading-relaxed">{log.details}</p>
                </div>
                <div className="text-right shrink-0 self-end sm:self-center">
                  <span className="text-xs text-neutral-200 font-bold block">{log.performed_by}</span>
                  <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
