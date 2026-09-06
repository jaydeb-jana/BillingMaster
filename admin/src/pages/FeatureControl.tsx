import React, { useState } from 'react';
import { ToggleLeft, ToggleRight, ShieldAlert, Cpu, Lock, MessageSquare, AlertOctagon, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface FeatureFlag {
  name: string;
  description: string;
  is_enabled: boolean;
  category: string;
}

interface FeatureControlProps {
  flags: Record<string, FeatureFlag>;
  onToggleFlag: (flagKey: string, isEnabled: boolean) => Promise<void>;
}

export const FeatureControl: React.FC<FeatureControlProps> = ({ flags, onToggleFlag }) => {
  const [confirmLockdownModal, setConfirmLockdownModal] = useState(false);

  const handleToggle = async (key: string, currentVal: boolean) => {
    if (key === 'maintenance_mode' && !currentVal) {
      setConfirmLockdownModal(true);
      return;
    }

    try {
      await onToggleFlag(key, !currentVal);
      toast.success(`Feature "${flags[key]?.name}" is now ${!currentVal ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle feature flag');
    }
  };

  const handleConfirmLockdown = async () => {
    try {
      await onToggleFlag('maintenance_mode', true);
      setConfirmLockdownModal(false);
      toast.warning('GLOBAL MAINTENANCE LOCKDOWN ACTIVATED. Write operations restricted.');
    } catch (err: any) {
      toast.error('Failed to trigger lockdown');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ToggleLeft className="w-5 h-5 text-orange-400" />
            Master Feature Controls & System Switches
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Instantly toggle platform capabilities, AI engine access, self-service registration, and global safety lockdowns.
          </p>
        </div>
      </div>

      {/* Feature Flags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(flags).map(([key, flag]) => {
          const isLockdown = key === 'maintenance_mode';
          return (
            <div
              key={key}
              className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${
                isLockdown && flag.is_enabled
                  ? 'bg-rose-950/40 border-rose-500/50 shadow-xl shadow-rose-500/10'
                  : 'bg-neutral-900/70 border-neutral-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-neutral-950 text-orange-400 border border-neutral-800 uppercase tracking-wider">
                    {flag.category}
                  </span>
                  <span className="text-xs font-mono text-neutral-500">{key}</span>
                </div>

                <h3 className="text-lg font-bold text-white">{flag.name}</h3>
                <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{flag.description}</p>
              </div>

              <div className="pt-6 mt-6 border-t border-neutral-800/80 flex items-center justify-between">
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    flag.is_enabled ? (isLockdown ? 'text-rose-400' : 'text-emerald-400') : 'text-neutral-500'
                  }`}
                >
                  {flag.is_enabled ? (isLockdown ? 'LOCKDOWN ACTIVE' : 'State: ENABLED') : 'State: DISABLED'}
                </span>

                <button
                  onClick={() => handleToggle(key, flag.is_enabled)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    flag.is_enabled
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  {flag.is_enabled ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-neutral-400" />}
                  <span>{flag.is_enabled ? 'Turn OFF' : 'Turn ON'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Global Maintenance Lockdown */}
      {confirmLockdownModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertOctagon className="w-8 h-8" />
              <div>
                <h3 className="text-lg font-bold text-white">Enable Global Lockdown?</h3>
                <p className="text-xs text-rose-300 font-medium">Critical System Governance Action</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Enabling Global Maintenance Lockdown will restrict tenant write operations and invoice issuing across all active stores. Are you sure you want to proceed?
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button
                onClick={() => setConfirmLockdownModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancel Action
              </button>
              <button
                onClick={handleConfirmLockdown}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Confirm Lockdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
