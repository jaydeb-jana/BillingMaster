import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  changeText?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  changeText,
  changeType = 'positive',
  icon: Icon,
  subtitle,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 shadow-xl hover:border-neutral-700/80 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">{title}</span>
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-orange-500/20 transition-all shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">{value}</h3>
        {changeText && (
          <span
            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
              changeType === 'positive'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : changeType === 'negative'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            {changeText}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-neutral-400 mt-2 font-medium leading-normal">{subtitle}</p>}
    </div>
  );
};
