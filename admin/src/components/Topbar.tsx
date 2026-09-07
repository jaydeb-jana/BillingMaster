import React from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
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
