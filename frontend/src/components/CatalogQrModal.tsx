import React, { useState, useRef } from 'react';
import {
  X, Download, Printer, Copy, Check, QrCode, Sparkles, Store, Phone,
  MapPin, ShieldCheck, Palette, LayoutTemplate, Layers, CheckCircle2, ArrowRight
} from 'lucide-react';
import domtoimage from 'dom-to-image';
import { toast } from 'sonner';
import { useBodyScrollLock, useScrollReset } from '@/lib/useScrollReset';

export interface CatalogQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeUrl: string;
  storeHandle: string;
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  businessGstin?: string;
}

export type QrStylePreset = 'standard' | 'standee' | 'dark-neon' | 'minimal';

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
  bgHex?: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { id: 'orange', label: 'Primary Orange', hex: 'f97316' },
  { id: 'emerald', label: 'Emerald Green', hex: '059669' },
  { id: 'indigo', label: 'Deep Indigo', hex: '4f46e5' },
  { id: 'black', label: 'Midnight Black', hex: '09090b' },
];

export function CatalogQrModal({
  isOpen,
  onClose,
  storeUrl,
  storeHandle,
  businessName,
  businessPhone,
  businessAddress,
  businessGstin,
}: CatalogQrModalProps) {
  useScrollReset(isOpen);
  useBodyScrollLock(isOpen);

  const [selectedStyle, setSelectedStyle] = useState<QrStylePreset>('standard');
  const [selectedColor, setSelectedColor] = useState<string>('orange');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const activeColor = COLOR_OPTIONS.find((c) => c.id === selectedColor) || COLOR_OPTIONS[0];
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    storeUrl
  )}&color=${activeColor.hex}&margin=8`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success('Store catalog link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy store link.');
    }
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await domtoimage.toPng(cardRef.current, {
        quality: 0.95,
        bgcolor: selectedStyle === 'dark-neon' ? '#09090b' : '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `store_qr_${storeHandle}_${selectedStyle}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('QR Code poster downloaded successfully!');
    } catch (err) {
      console.error('Error downloading QR poster:', err);
      toast.error('Failed to download image. Try printing or saving instead.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintQr = () => {
    if (!cardRef.current) return;
    const printContent = cardRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print the QR poster.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Store QR Code - ${businessName}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              background: #fff;
            }
            .print-wrapper {
              max-width: 480px;
              width: 100%;
            }
          </style>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="card-shell max-w-2xl w-full max-h-[92vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight">Store Catalog QR Code Studio</h3>
              <p className="text-xs text-muted-foreground font-medium">Generate, style & print QR codes for your digital store link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STYLE SELECTOR TABS */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LayoutTemplate size={14} className="text-primary" />
              <span>Choose QR Design & Style Preset</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStyle('standard')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedStyle === 'standard'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 font-bold text-foreground'
                    : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold mb-0.5">
                  <span>Standard</span>
                  {selectedStyle === 'standard' && <CheckCircle2 size={13} className="text-primary" />}
                </div>
                <p className="text-[10px] opacity-80 leading-snug">Clean Corporate Card</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStyle('standee')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedStyle === 'standee'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 font-bold text-foreground'
                    : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold mb-0.5">
                  <span>Shop Standee</span>
                  {selectedStyle === 'standee' && <CheckCircle2 size={13} className="text-primary" />}
                </div>
                <p className="text-[10px] opacity-80 leading-snug">Counter Display Poster</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStyle('dark-neon')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedStyle === 'dark-neon'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 font-bold text-foreground'
                    : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold mb-0.5">
                  <span>Dark Cyber</span>
                  {selectedStyle === 'dark-neon' && <CheckCircle2 size={13} className="text-primary" />}
                </div>
                <p className="text-[10px] opacity-80 leading-snug">Sleek Glowing Neon</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStyle('minimal')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedStyle === 'minimal'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30 font-bold text-foreground'
                    : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-extrabold mb-0.5">
                  <span>Minimalist</span>
                  {selectedStyle === 'minimal' && <CheckCircle2 size={13} className="text-primary" />}
                </div>
                <p className="text-[10px] opacity-80 leading-snug">Compact Badge</p>
              </button>
            </div>
          </div>


          {/* QR CODE PREVIEW CARD CONTAINER */}
          <div className="flex items-center justify-center p-4 bg-muted/30 rounded-2xl border border-border/70 overflow-hidden">
            <div
              ref={cardRef}
              className="w-full max-w-sm transition-all duration-200"
            >
              {/* PREVIEW STYLE 1: STANDARD BRAND CARD */}
              {selectedStyle === 'standard' && (
                <div className="p-6 rounded-3xl bg-card border-2 border-primary/30 shadow-xl text-center space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-amber-500 to-emerald-500" />
                  
                  <div className="pt-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider mb-2">
                      <Store size={13} />
                      <span>{businessName || 'Store Catalog'}</span>
                    </div>
                    <h4 className="text-base font-black text-foreground tracking-tight">Scan to View Digital Catalog</h4>
                    <p className="text-[11px] text-muted-foreground font-medium">Browse live stock & prices on your phone</p>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-md inline-block mx-auto">
                    <img
                      src={qrApiUrl}
                      alt="Store Catalog QR Code"
                      className="w-48 h-48 mx-auto object-contain"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="inline-block px-3 py-1 rounded-lg bg-muted text-foreground font-mono text-xs font-bold border border-border">
                      /catalog/{storeHandle}
                    </span>
                    <p className="text-[10px] text-muted-foreground font-mono truncate px-4">{storeUrl}</p>
                  </div>
                </div>
              )}

              {/* PREVIEW STYLE 2: SHOP COUNTER TABLE STANDEE POSTER */}
              {selectedStyle === 'standee' && (
                <div className="p-6 rounded-3xl bg-white text-slate-900 border-4 border-slate-900 shadow-2xl text-center space-y-4 relative">
                  <div className="bg-slate-900 text-white py-2 px-4 rounded-xl -mx-2 -mt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">WELCOME TO OUR STORE</p>
                    <h3 className="text-lg font-black tracking-tight">{businessName || 'Store Name'}</h3>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">SCAN ME WITH YOUR CAMERA</h4>
                    <p className="text-[11px] text-slate-500 font-semibold">To view instant catalog, price directory & availability</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-900 shadow-inner inline-block mx-auto">
                    <img
                      src={qrApiUrl}
                      alt="Store Catalog QR Code"
                      className="w-48 h-48 mx-auto object-contain"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1 text-left text-[11px] bg-slate-100 p-3 rounded-xl border border-slate-300 font-medium">
                    {businessPhone && (
                      <p className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Phone size={12} className="text-slate-600 shrink-0" />
                        <span>Phone: {businessPhone}</span>
                      </p>
                    )}
                    {businessGstin && (
                      <p className="flex items-center gap-1.5 text-slate-600 font-mono">
                        <ShieldCheck size={12} className="text-slate-600 shrink-0" />
                        <span>GSTIN: {businessGstin}</span>
                      </p>
                    )}
                    {businessAddress && (
                      <p className="flex items-center gap-1.5 text-slate-600 truncate">
                        <MapPin size={12} className="text-slate-600 shrink-0" />
                        <span>{businessAddress}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* PREVIEW STYLE 3: DARK CYBER NEON */}
              {selectedStyle === 'dark-neon' && (
                <div className="p-6 rounded-3xl bg-[#09090b] text-white border-2 border-emerald-500/40 shadow-2xl text-center space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-indigo-500" />
                  
                  <div className="space-y-1 pt-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                      ● LIVE DIGITAL STORE
                    </div>
                    <h4 className="text-base font-black text-white tracking-tight">{businessName}</h4>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] inline-block mx-auto">
                    <img
                      src={qrApiUrl}
                      alt="Store Catalog QR Code"
                      className="w-48 h-48 mx-auto object-contain"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-mono font-extrabold text-emerald-400">/catalog/{storeHandle}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Scan to launch mobile digital catalog</p>
                  </div>
                </div>
              )}

              {/* PREVIEW STYLE 4: MINIMALIST BADGE */}
              {selectedStyle === 'minimal' && (
                <div className="p-6 rounded-3xl bg-card border-2 border-border shadow-lg text-center space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-gray-300 shadow-xs inline-block mx-auto">
                    <img
                      src={qrApiUrl}
                      alt="Store Catalog QR Code"
                      className="w-44 h-44 mx-auto object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-foreground">{businessName}</h4>
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-muted text-foreground font-mono text-[11px] font-bold border border-border">
                      /catalog/{storeHandle}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER WITH ACTIONS */}
        <div className="px-5 py-3.5 border-t border-border/80 bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintQr}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer flex-1 sm:flex-initial"
            >
              <Printer size={15} className="text-primary" />
              <span>Print Poster</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer flex-1 sm:flex-initial"
            >
              <Download size={15} />
              <span>{downloading ? 'Exporting Image...' : 'Download PNG'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
