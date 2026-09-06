import React from 'react';
import { StatCard } from '../components/StatCard';
import {
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface OverviewProps {
  stats: {
    totalBusinesses: number;
    totalUsers: number;
    totalCustomers?: number;
    totalInvoices: number;
    totalRevenue: number;
    activePlansCount: number;
    planBreakdownText?: string;
    systemHealth: string;
    activeFeatureFlags: number;
  };
  onNavigateTab: (tab: string) => void;
}

const mockChartData = [
  { month: 'Jan', revenue: 45000, invoices: 120, tenants: 4 },
  { month: 'Feb', revenue: 68000, invoices: 180, tenants: 6 },
  { month: 'Mar', revenue: 95000, invoices: 240, tenants: 8 },
  { month: 'Apr', revenue: 140000, invoices: 310, tenants: 10 },
  { month: 'May', revenue: 210000, invoices: 420, tenants: 11 },
  { month: 'Jun', revenue: 285400, invoices: 512, tenants: 12 },
];

export const DashboardOverview: React.FC<OverviewProps> = ({ stats, onNavigateTab }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="p-6 lg:p-7 rounded-2xl bg-gradient-to-r from-[#121217] via-orange-950/20 to-[#121217] border border-neutral-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2.5">
              <Sparkles className="w-3.5 h-3.5" />
              Platform Command Center
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Welcome to <span className="orange-gradient-text">BillingMaster Admin</span>
            </h1>
            <p className="text-neutral-400 text-xs lg:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Full-spectrum tenant governance, subscription plan studio, real-time secret strategy broadcasts, feature flag controls, and infrastructure audit logs.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigateTab('bulletins')}
              className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Secret Strategy Center
            </button>
            <button
              onClick={() => onNavigateTab('plans')}
              className="px-4 py-2.5 rounded-xl bg-[#1b1b22] hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 font-bold text-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Manage Pricing Plans
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - Exactly 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          title="Total Gross Revenue"
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          changeText="+28.4% MoM"
          changeType="positive"
          icon={DollarSign}
          subtitle="Processed across all active merchant accounts"
        />
        <StatCard
          title="Total Customers"
          value={(stats.totalCustomers || 186).toLocaleString()}
          changeText="+18% Growth"
          changeType="positive"
          icon={Users}
          subtitle="Registered buyers across all tenant stores"
        />
        <StatCard
          title="Active Businesses"
          value={stats.totalBusinesses}
          changeText="Active Tiers"
          changeType="neutral"
          icon={Building2}
          subtitle={stats.planBreakdownText || 'Free (1) • Starter (2) • Pro (2)'}
        />
      </div>

      {/* Revenue Trajectory Full-Width Chart */}
      <div className="p-6 rounded-2xl bg-[#121217] border border-neutral-800 space-y-5 shadow-xl w-full">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              Platform Growth & Revenue Trajectory
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">Aggregated merchant billing activity over time</p>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-1 bg-neutral-900 text-orange-400 rounded-lg border border-neutral-800">
            Live Feed
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockChartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#22222a" />
              <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} tickFormatter={(val) => `₹${val / 1000}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#17171c',
                  borderColor: '#27272a',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
