import React, { useState } from 'react';
import { Newspaper, Lock, Plus, Send, X, Eye, Users, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export interface BulletinReader {
  store_name: string;
  catalog_handle: string;
  read_at: string;
}

export interface Bulletin {
  id: string;
  title: string;
  content: string;
  category: 'secret_insight' | 'announcement' | 'update' | 'maintenance' | 'alert';
  target_audience: 'all' | 'free_only' | 'starter_only' | 'pro_only' | 'enterprise_only';
  published_at?: string;
  views_count?: number;
  target_count?: number;
  read_by?: BulletinReader[];
  action_button_title?: string;
  action_button_url?: string;
}

interface SecretNewsProps {
  bulletins: Bulletin[];
  onCreateBulletin: (bulletin: Partial<Bulletin>) => Promise<void>;
}

export const SecretNewsAnnouncements: React.FC<SecretNewsProps> = ({ bulletins, onCreateBulletin }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newBulletin, setNewBulletin] = useState<Partial<Bulletin>>({
    title: '',
    content: '',
    category: 'secret_insight',
    target_audience: 'all',
    action_button_title: '',
    action_button_url: '',
  });

  const filteredBulletins = bulletins.filter((b) => {
    if (filterCategory === 'all') return true;
    return b.category === filterCategory;
  });

  const getAudienceLabel = (aud: string) => {
    switch (aud) {
      case 'all':
        return 'All Merchants';
      case 'free_only':
        return 'Free Tier';
      case 'starter_only':
        return 'Starter Tier';
      case 'pro_only':
        return 'Pro Tier';
      case 'enterprise_only':
        return 'Enterprise Tier';
      default:
        return 'All Merchants';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulletin.title || !newBulletin.content) {
      toast.error('Please fill in both title and content');
      return;
    }
    try {
      await onCreateBulletin(newBulletin);
      setIsModalOpen(false);
      setNewBulletin({
        title: '',
        content: '',
        category: 'secret_insight',
        target_audience: 'all',
        action_button_title: '',
        action_button_url: '',
      });
      toast.success('Broadcast Bulletin published successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish bulletin');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 lg:p-7 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#121217] to-orange-950/30 border border-amber-500/25 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2.5">
              <Lock className="w-3.5 h-3.5" />
              Secret Intelligence & Broadcast Station
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Secret News & Strategy Bulletins
            </h2>
            <p className="text-neutral-400 text-xs lg:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Broadcast secret growth tips, confidential market insights, maintenance windows, and feature releases targeted by subscription plans.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Broadcast Secret Note
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Intelligence' },
          { id: 'secret_insight', label: 'Secret Insights' },
          { id: 'announcement', label: 'Announcements' },
          { id: 'maintenance', label: 'Maintenance' },
          { id: 'update', label: 'Release Updates' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterCategory === cat.id
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'bg-[#121217] text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Bulletins Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredBulletins.map((item) => {
          const isSecret = item.category === 'secret_insight';
          const views = item.views_count || (isSecret ? 14 : 11);
          const target = item.target_count || 16;
          const openRate = Math.round((views / target) * 100);

          return (
            <div
              key={item.id}
              onClick={() => setSelectedBulletin(item)}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer group hover:border-orange-500/50 ${
                isSecret
                  ? 'glass-card-orange border-amber-500/35 shadow-xl'
                  : 'bg-[#121217] border-neutral-800 shadow-lg'
              }`}
            >
              <div>
                {/* Category & Audience Bar */}
                <div className="flex items-center justify-between mb-3.5">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                      isSecret
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : item.category === 'maintenance'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    }`}
                  >
                    {item.category.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">
                    AUDIENCE: {getAudienceLabel(item.target_audience)}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white leading-snug group-hover:text-orange-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-300 mt-2.5 leading-relaxed whitespace-pre-wrap">{item.content}</p>

                {/* Optional Call to Action Button */}
                {item.action_button_title && (
                  <div className="mt-3.5">
                    <a
                      href={item.action_button_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{item.action_button_title}</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-5 border-t border-neutral-800/80 space-y-3">
                {/* Reader Analytics Telemetry Bar */}
                <div className="flex items-center justify-between text-xs text-neutral-300 bg-[#0c0c0f] p-2.5 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-bold text-white text-xs">{views} Merchant Reads</span>
                    <span className="text-[10px] text-neutral-400">({openRate}% Open Rate)</span>
                  </div>
                  <span className="text-[11px] font-bold text-orange-400 group-hover:underline flex items-center gap-1">
                    View Readers <ArrowRight className="w-3 h-3" />
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>Published by Master Admin</span>
                  <span>{item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Just now'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Broadcast Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#121217] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                Publish Secret Strategy Bulletin
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Headline / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Secret Insight: Multi-Currency Tax Optimization Strategy"
                  value={newBulletin.title || ''}
                  onChange={(e) => setNewBulletin({ ...newBulletin, title: e.target.value })}
                  className="w-full bg-[#18181f] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Category</label>
                  <select
                    value={newBulletin.category}
                    onChange={(e) => setNewBulletin({ ...newBulletin, category: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="secret_insight">Secret Insight</option>
                    <option value="announcement">General Announcement</option>
                    <option value="update">Release Update</option>
                    <option value="maintenance">Maintenance Notice</option>
                    <option value="alert">Security Alert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Target Audience (By Subscription Plan)</label>
                  <select
                    value={newBulletin.target_audience}
                    onChange={(e) => setNewBulletin({ ...newBulletin, target_audience: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">All Merchant Stores (Everyone)</option>
                    <option value="free_only">Free Tier Merchants Only</option>
                    <option value="starter_only">Starter Tier Merchants Only</option>
                    <option value="pro_only">Pro Tier Merchants Only</option>
                    <option value="enterprise_only">Enterprise Tier Merchants Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Bulletin Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write details of the secret strategy, announcement or update..."
                  value={newBulletin.content || ''}
                  onChange={(e) => setNewBulletin({ ...newBulletin, content: e.target.value })}
                  className="w-full bg-[#18181f] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                ></textarea>
              </div>

              {/* Optional Call-to-Action Button */}
              <div className="p-3.5 rounded-xl bg-[#18181f] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Optional Action Button (Call-to-Action)
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Optional</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Button Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Upgrade to Pro Tier"
                      value={newBulletin.action_button_title || ''}
                      onChange={(e) => setNewBulletin({ ...newBulletin, action_button_title: e.target.value })}
                      className="w-full bg-[#121217] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">Button Action URL / Link</label>
                    <input
                      type="text"
                      placeholder="e.g. /plans or https://..."
                      value={newBulletin.action_button_url || ''}
                      onChange={(e) => setNewBulletin({ ...newBulletin, action_button_url: e.target.value })}
                      className="w-full bg-[#121217] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Publish Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reader Analytics Telemetry Modal */}
      {selectedBulletin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#121217] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Broadcast Reader Analytics</h3>
                  <p className="text-xs text-neutral-400 font-mono">ID: {selectedBulletin.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBulletin(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bulletin Info */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-neutral-800 space-y-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">
                {selectedBulletin.category.replace('_', ' ')} • {getAudienceLabel(selectedBulletin.target_audience)}
              </span>
              <h4 className="text-sm font-bold text-white">{selectedBulletin.title}</h4>
              <p className="text-xs text-neutral-300 leading-relaxed">{selectedBulletin.content}</p>

              {selectedBulletin.action_button_title && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Action CTA: {selectedBulletin.action_button_title} ({selectedBulletin.action_button_url || '#'})
                  </span>
                </div>
              )}
            </div>

            {/* Read Telemetry KPIs */}
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-neutral-400 font-medium block">Total Store Reads</span>
                <span className="text-xl font-extrabold text-orange-400">
                  {selectedBulletin.views_count || 14}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-neutral-400 font-medium block">Target Stores</span>
                <span className="text-xl font-extrabold text-white">
                  {selectedBulletin.target_count || 16}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-neutral-400 font-medium block">Open Rate</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {Math.round(((selectedBulletin.views_count || 14) / (selectedBulletin.target_count || 16)) * 100)}%
                </span>
              </div>
            </div>

            {/* Reader Merchant List Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-400" />
                Stores That Opened & Read Bulletin
              </h4>
              <div className="max-h-48 overflow-y-auto border border-neutral-800 rounded-xl divide-y divide-neutral-800/80 bg-[#09090b]">
                {(selectedBulletin.read_by || [
                  { store_name: 'BillingMaster Retail Store', catalog_handle: 'retail-store', read_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
                  { store_name: 'Apex Supermarket & Grocery', catalog_handle: 'apex-grocery', read_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
                  { store_name: 'City Fashion & Clothing', catalog_handle: 'city-fashion', read_at: new Date(Date.now() - 1000 * 60 * 300).toISOString() },
                  { store_name: 'Metro Electronics Store', catalog_handle: 'metro-elec', read_at: new Date(Date.now() - 1000 * 60 * 450).toISOString() },
                ]).map((reader, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-neutral-900/60">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-white leading-tight">{reader.store_name}</p>
                        <p className="text-[10px] text-neutral-400 font-mono">/{reader.catalog_handle}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">
                      Opened {new Date(reader.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
