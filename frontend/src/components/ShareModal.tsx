import React, { useState } from 'react';
import {
  X, Copy, Check, MessageSquare, Mail, Share2, Send,
  Twitter, Link as LinkIcon, Package
} from 'lucide-react';
import { toast } from 'sonner';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  shareUrl: string;
  shareText: string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  title = 'Share',
  subtitle,
  shareUrl,
  shareText,
  productName,
  productPrice,
  productImage,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyFullText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Product details & link copied!');
    } catch (err) {
      toast.error('Failed to copy content');
    }
  };

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = () => {
    const subject = productName ? `Check out "${productName}"` : `Catalog from ${subtitle || 'BillingMaster'}`;
    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
    window.open(mailUrl, '_self');
  };

  const handleTwitter = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productName || title,
          text: shareText,
          url: shareUrl,
        });
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error('Could not share link');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Share2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground tracking-tight">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close share dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Product Preview Card (if product details provided) */}
        {productName && (
          <div className="flex items-center gap-3.5 rounded-2xl border border-border/80 bg-muted/40 p-3.5">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="h-14 w-14 rounded-xl object-contain bg-background border border-border/60 p-1 shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-background border border-border/60 shrink-0 text-muted-foreground">
                <Package size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-black text-foreground line-clamp-1">{productName}</h3>
              {typeof productPrice === 'number' && (
                <p className="text-xs font-extrabold text-primary mt-0.5">₹{productPrice.toLocaleString('en-IN')}</p>
              )}
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{shareUrl}</p>
            </div>
          </div>
        )}

        {/* Primary Share Options Grid */}
        <div className="grid grid-cols-4 gap-3 pt-1">
          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-3 text-center transition-all group"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <MessageSquare size={20} />
            </div>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">WhatsApp</span>
          </button>

          {/* Email */}
          <button
            onClick={handleEmail}
            className="flex flex-col items-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 p-3 text-center transition-all group"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-xs group-hover:scale-110 transition-transform">
              <Mail size={20} />
            </div>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">Email</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 p-3 text-center transition-all group"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-110 transition-transform">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </div>
            <span className="text-[11px] font-bold text-primary">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* Device / System Share or Telegram */}
          {typeof navigator !== 'undefined' && 'share' in navigator ? (
            <button
              onClick={handleSystemShare}
              className="flex flex-col items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 p-3 text-center transition-all group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Share2 size={20} />
              </div>
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">More</span>
            </button>
          ) : (
            <button
              onClick={handleTelegram}
              className="flex flex-col items-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 p-3 text-center transition-all group"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500 text-white shadow-xs group-hover:scale-110 transition-transform">
                <Send size={20} />
              </div>
              <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300">Telegram</span>
            </button>
          )}
        </div>

        {/* Secondary Social Channels */}
        <div className="flex items-center justify-center gap-3 pt-1 border-t border-border/60">
          <button
            onClick={handleTwitter}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <Twitter size={14} className="text-sky-500" />
            <span>X (Twitter)</span>
          </button>

          <button
            onClick={handleTelegram}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <Send size={14} className="text-sky-600" />
            <span>Telegram</span>
          </button>

          <button
            onClick={handleCopyFullText}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors"
          >
            <LinkIcon size={14} className="text-amber-500" />
            <span>Copy Text</span>
          </button>
        </div>

        {/* Direct Link Input Box */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            Direct Shareable URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 rounded-xl bg-muted border border-border/80 px-3 py-2 text-xs font-mono text-foreground focus:outline-none select-all"
            />
            <button
              onClick={handleCopyLink}
              className="rounded-xl btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
