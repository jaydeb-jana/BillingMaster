import React from 'react';
import { Search, PlusCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TopbarProps {
  activeTabTitle: string;
  onRefreshData?: () => void;
  onOpenQuickBulletin?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ activeTabTitle, onRefreshData, onOpenQuickBulletin }) => {
  return (
    <header className="h-16 bg-[#0c0c0f]/90 border-b border-neutral-800/80 px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl">
      {/* Title & Path */}
      <div className="shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-semibold mb-0.5">
          <span>BillingMaster</span>
          <span className="text-neutral-600">/</span>
          <span className="text-orange-400 font-bold">Admin Panel</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-tight">{activeTabTitle}</h2>
      </div>

      {/* Center Search Bar */}
      <div className="relative w-80 lg:w-96 hidden md:block mx-4">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search tenants, plan codes, secret news, audit logs..."
          className="w-full h-9 bg-[#131317] border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {onRefreshData && (
          <button
            onClick={() => {
              onRefreshData();
              toast.info('Refreshed admin live metrics');
            }}
            className="p-2 rounded-xl bg-[#131317] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-all cursor-pointer"
            title="Refresh Platform Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {onOpenQuickBulletin && (
          <button
            onClick={onOpenQuickBulletin}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Broadcast Note</span>
          </button>
        )}
      </div>
    </header>
  );
};
