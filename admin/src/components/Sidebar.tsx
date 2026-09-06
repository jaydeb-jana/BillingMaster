import React from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Building2,
  Newspaper,
  ToggleLeft,
  ShieldCheck,
  Activity,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemHealth: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, systemHealth }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'plans', label: 'Plan & Pricing Studio', icon: CreditCard },
    { id: 'businesses', label: 'Business Governance', icon: Building2 },
    { id: 'bulletins', label: 'Secret News & Bulletins', icon: Newspaper },
    { id: 'features', label: 'Feature Flags', icon: ToggleLeft },
    { id: 'audit', label: 'Audit & Health', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-[#0c0c0f] border-r border-neutral-800/80 flex flex-col justify-between h-screen sticky top-0 z-30 select-none shrink-0">
      <div>
        {/* Brand Header with Authentic BillingMaster Logo */}
        <div className="p-5 border-b border-neutral-800/80 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="BillingMaster Logo"
            className="h-9 w-9 rounded-xl object-contain bg-neutral-900/50 p-0.5 shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
          />
          <div>
            <h1 className="font-extrabold text-base text-white tracking-tight flex items-center gap-0.5">
              BillingMaster<span className="text-orange-500">.</span>
            </h1>
            <p className="text-[11px] font-medium text-neutral-400">Admin Control Center</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            Control Center
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 font-semibold shadow-xs'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-orange-400' : 'text-neutral-400'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Status Footer */}
      <div className="p-3.5 m-3 rounded-xl bg-[#131317] border border-neutral-800/80">
        <div className="flex items-center justify-between text-xs text-neutral-300 mb-2">
          <span className="flex items-center gap-2 font-semibold text-[11px]">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Backend Engine
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 uppercase">
            {systemHealth}
          </span>
        </div>
        <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-2">
          <div className="bg-emerald-500 h-full w-full animate-pulse"></div>
        </div>
        <p className="text-[10px] text-neutral-500 font-mono">v1.0.0-admin • Node 5000 API</p>
      </div>
    </aside>
  );
};
