import React, { useState, useEffect } from 'react';
import {
  X, Check, Printer, FileText, LayoutTemplate,
  Maximize2, Smartphone, CheckCircle2, Layers,
  Palette, Stamp
} from 'lucide-react';
import { db, auth, supabase } from '@/lib/api';
import { useScrollReset } from '@/lib/useScrollReset';

export interface InvoiceTemplateSettings {
  template_id: 'standard' | 'modern' | 'gst-pro' | 'pos-thermal' | 'executive';
  gst_template_id?: 'gst-pro' | 'standard';
  nongst_template_id?: 'modern' | 'pos-thermal' | 'executive';
  print_size: 'A4' | 'A5' | '80mm' | '58mm' | 'Letter';
  show_logo: boolean;
  show_qr_code: boolean;
  show_signature: boolean;
  show_bank_details: boolean;
  show_terms: boolean;
  show_tax_breakdown: boolean;
  header_accent_color?: string;
  default_copies?: 'original' | 'duplicate' | 'triplicate';
}

export const DEFAULT_TEMPLATE_SETTINGS: InvoiceTemplateSettings = {
  template_id: 'standard',
  gst_template_id: 'gst-pro',
  nongst_template_id: 'modern',
  print_size: 'A4',
  show_logo: true,
  show_qr_code: true,
  show_signature: true,
  show_bank_details: true,
  show_terms: true,
  show_tax_breakdown: true,
  header_accent_color: '#f97316',
  default_copies: 'original',
};

export const INVOICE_TEMPLATES = [
  {
    id: 'standard' as const,
    name: 'Standard Commercial',
    tagline: 'Clean & Structured Corporate Layout',
    badge: 'Most Popular',
    badgeColor: 'bg-primary text-white',
    desc: 'Professional dual-column header, GSTIN badge, structured itemized table, subtotal breakdown, and dedicated bank transfer block.',
    bestFor: 'General Retail, Wholesale & Commercial Traders',
  },
  {
    id: 'modern' as const,
    name: 'Modern Minimalist',
    tagline: 'Sleek Borderless Contemporary Design',
    badge: 'Modern',
    badgeColor: 'bg-blue-600 text-white',
    desc: 'High-contrast dark title banner, clean borderless rows, bold typography accents, and spacious visual hierarchy.',
    bestFor: 'Boutiques, Tech Stores, Agencies & Consultancies',
  },
  {
    id: 'gst-pro' as const,
    name: 'GST Tax Pro (Compliance)',
    tagline: 'Full Tax Audit & Government Standard',
    badge: 'GST Ready',
    badgeColor: 'bg-emerald-600 text-white',
    desc: 'Detailed HSN/SAC code table, split CGST + SGST or IGST columns, reverse charge flag, state code, and prominent UPI QR code.',
    bestFor: 'GST Registered Merchants, Manufacturers & Distributors',
  },
  {
    id: 'pos-thermal' as const,
    name: 'Compact Thermal POS',
    tagline: 'High-Speed Receipt Layout',
    badge: 'Thermal POS',
    badgeColor: 'bg-cyan-600 text-white',
    desc: 'Optimized for high-speed thermal printers (58mm/80mm) with center store header, dashed line dividers, item x price summary, and bottom barcode.',
    bestFor: 'Supermarkets, Kirana Stores, Bakeries & Quick Counters',
  },
  {
    id: 'executive' as const,
    name: 'Classic Executive',
    tagline: 'Formal Letterhead & Stamp Border',
    badge: 'Executive',
    badgeColor: 'bg-amber-600 text-white',
    desc: 'Double-line decorative framed border, formal authorized signatory box with digital seal placeholder, and classic typography.',
    bestFor: 'High-Value Invoicing, Legal, Engineering & Corporate Contracts',
  },
];

export const PRINT_SIZES = [
  {
    id: 'A4' as const,
    name: 'A4 Full Page',
    dimensions: '210 × 297 mm (8.27 × 11.69 in)',
    tag: 'Standard Desktop',
    desc: 'Full-size sheet for standard desktop Laser and Inkjet printers. Recommended for commercial & GST tax invoices.',
    icon: FileText,
  },
  {
    id: 'A5' as const,
    name: 'A5 Half Page',
    dimensions: '148 × 210 mm (5.83 × 8.27 in)',
    tag: 'Compact Sheet',
    desc: 'Half the size of A4. Ideal for compact duplicate bill books, wholesale dispatch slips, and paper saving.',
    icon: Layers,
  },
  {
    id: '80mm' as const,
    name: '80mm Thermal Receipt (3-Inch)',
    dimensions: '80mm Roll Width (~32–48 cols)',
    tag: 'Counter POS',
    desc: 'Standard countertop thermal receipt printers (Epson TM-T82, TVS, NGX, Posiflex). Auto-cuts roll paper.',
    icon: Printer,
  },
  {
    id: '58mm' as const,
    name: '58mm Mini POS (2-Inch)',
    dimensions: '58mm Roll Width (~24–32 cols)',
    tag: 'Wireless / Handheld',
    desc: 'Portable Bluetooth & battery-operated handheld billing machines. Ultra-compact line formatting.',
    icon: Smartphone,
  },
  {
    id: 'Letter' as const,
    name: 'US Letter Size',
    dimensions: '216 × 279 mm (8.5 × 11.0 in)',
    tag: 'Commercial Document',
    desc: 'Standard North American and commercial document paper size with generous margins.',
    icon: FileText,
  },
];

interface InvoiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: InvoiceTemplateSettings) => void;
}

export function InvoiceTemplateModal({ isOpen, onClose, onSaved }: InvoiceTemplateModalProps) {
  useScrollReset(isOpen);
  const [activeTab, setActiveTab] = useState<'templates' | 'sizes'>('templates');
  const [settings, setSettings] = useState<InvoiceTemplateSettings>(() => {
    try {
      const saved = localStorage.getItem('arventa_invoice_template_settings');
      if (saved) {
        return { ...DEFAULT_TEMPLATE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_TEMPLATE_SETTINGS;
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load latest settings on mount
  useEffect(() => {
    async function loadLatest() {
      try {
        let loadedSettings: Partial<InvoiceTemplateSettings> = {};
        const localRaw = localStorage.getItem('arventa_invoice_template_settings');
        if (localRaw) {
          loadedSettings = JSON.parse(localRaw);
        }

        const taxRaw = localStorage.getItem('arventa_tax_settings');
        if (taxRaw) {
          const parsedTax = JSON.parse(taxRaw);
          if (parsedTax.invoice_template) {
            loadedSettings.template_id = parsedTax.invoice_template;
          }
          if (parsedTax.invoice_print_size) {
            loadedSettings.print_size = parsedTax.invoice_print_size;
          }
        }

        const session = auth.session();
        if (session?.user?.id) {
          const bizRaw = localStorage.getItem(`arventa_biz_${session.user.id}`);
          if (bizRaw) {
            const parsedBiz = JSON.parse(bizRaw);
            if (parsedBiz.invoice_template) loadedSettings.template_id = parsedBiz.invoice_template;
            if (parsedBiz.invoice_print_size) loadedSettings.print_size = parsedBiz.invoice_print_size;
          }
        }

        setSettings(prev => ({ ...prev, ...loadedSettings }));
      } catch (err) {
        console.warn('Could not load invoice template settings:', err);
      }
    }
    if (isOpen) {
      void loadLatest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save to local storage
      localStorage.setItem('arventa_invoice_template_settings', JSON.stringify(settings));

      // Update global tax/invoice settings cache
      try {
        const taxRaw = localStorage.getItem('arventa_tax_settings');
        const taxObj = taxRaw ? JSON.parse(taxRaw) : {};
        taxObj.invoice_template = settings.template_id;
        taxObj.invoice_print_size = settings.print_size;
        localStorage.setItem('arventa_tax_settings', JSON.stringify(taxObj));
      } catch {}

      // 2. Save to user profile & Supabase if logged in
      const session = auth.session();
      if (session?.user?.id) {
        try {
          const bizRaw = localStorage.getItem(`arventa_biz_${session.user.id}`);
          const bizObj = bizRaw ? JSON.parse(bizRaw) : {};
          bizObj.invoice_template = settings.template_id;
          bizObj.invoice_print_size = settings.print_size;
          localStorage.setItem(`arventa_biz_${session.user.id}`, JSON.stringify(bizObj));
        } catch {}

        try {
          await supabase.auth.updateUser({
            data: {
              invoice_template: settings.template_id,
              invoice_print_size: settings.print_size,
              invoice_template_settings: settings,
            }
          });
        } catch {}

        try {
          const profiles = await db.list<any>('profiles', { id: session.user.id });
          const bid = profiles.length ? profiles[0].business_id : null;
          if (bid) {
            await db.upsert('settings', {
              business_id: bid,
              invoice_template: settings.template_id,
            });
          }
        } catch {}
      }

      setSavedSuccess(true);
      if (onSaved) onSaved(settings);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error saving template settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedTemplate = INVOICE_TEMPLATES.find(t => t.id === settings.template_id) || INVOICE_TEMPLATES[0];
  const selectedPrintSize = PRINT_SIZES.find(s => s.id === settings.print_size) || PRINT_SIZES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
      <div className="card-shell w-full max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden animate-rise shadow-2xl border border-border">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <LayoutTemplate size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-foreground">Invoice Templates & Print Setup</h3>
                <span className="hidden sm:inline-flex rounded-md bg-primary/15 text-primary text-[10px] font-black px-2 py-0.5">
                  {selectedTemplate.name} • {selectedPrintSize.id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Select invoice design templates & configure print page dimensions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-card text-foreground shadow-xs border border-border ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <Palette size={14} className={activeTab === 'templates' ? 'text-primary' : ''} />
            <span>1. Invoice Templates ({INVOICE_TEMPLATES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sizes')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'sizes'
                ? 'bg-card text-foreground shadow-xs border border-border ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <Printer size={14} className={activeTab === 'sizes' ? 'text-primary' : ''} />
            <span>2. Print Page Size ({selectedPrintSize.id})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* TAB 1: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">Select Visual Template</h4>
                  <p className="text-xs text-muted-foreground">Each template changes the layout, fonts, table format, and header accents of your invoices.</p>
                </div>
                <div className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/25">
                  Active: <span className="underline font-extrabold">{selectedTemplate.name}</span>
                </div>
              </div>

              {/* Live Preview Header Card */}
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3 border-b border-primary/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <LayoutTemplate size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-foreground flex items-center gap-2">
                        <span>{selectedTemplate.name}</span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${selectedTemplate.badgeColor}`}>
                          {selectedTemplate.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">{selectedTemplate.tagline}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-primary bg-background px-2.5 py-1 rounded-lg border border-primary/30 mono">
                    Live Preview ({selectedPrintSize.id})
                  </span>
                </div>

                <div className="h-28 w-full rounded-xl border border-border bg-card p-3 shadow-inner flex flex-col justify-between overflow-hidden text-[9px] select-none">
                  {selectedTemplate.id === 'gst-pro' && (
                    <div className="h-full flex flex-col justify-between space-y-1">
                      <div className="flex justify-between items-center border-b border-emerald-500/40 pb-1 text-emerald-600 font-bold text-[9px]">
                        <span className="flex items-center gap-1">GST TAX INVOICE (FULL COMPLIANCE)</span>
                        <span className="mono">GSTIN: 19ABCDE1234F1Z5</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[8px] font-bold text-muted-foreground bg-muted/40 p-1 rounded">
                        <span className="col-span-2">Item Description</span>
                        <span>HSN/SAC</span>
                        <span className="text-right font-mono">CGST + SGST (18%)</span>
                      </div>
                      <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded font-black text-emerald-700 dark:text-emerald-300 text-[9px]">
                        <span>TOTAL PAYABLE INCL. TAX</span>
                        <span className="mono">₹8,920.00</span>
                      </div>
                    </div>
                  )}

                  {selectedTemplate.id === 'standard' && (
                    <div className="h-full flex flex-col justify-between space-y-1">
                      <div className="flex justify-between items-center border-b border-border pb-1">
                        <div className="font-extrabold text-primary text-[10px]">BILLING MASTER COMMERCIAL</div>
                        <div className="mono text-muted-foreground font-bold text-[9px]">INV-2026-001</div>
                      </div>
                      <div className="flex justify-between text-muted-foreground py-0.5 text-[9px]">
                        <span>Structured Itemized Table & Subtotal</span>
                        <span className="mono font-bold text-foreground">₹4,250.00</span>
                      </div>
                      <div className="flex justify-between items-center bg-primary/10 p-1.5 rounded font-black text-primary text-[9px]">
                        <span>SUBTOTAL + TAX</span>
                        <span className="mono">₹4,250.00</span>
                      </div>
                    </div>
                  )}

                  {selectedTemplate.id === 'modern' && (
                    <div className="h-full flex flex-col justify-between space-y-1">
                      <div className="bg-foreground text-background px-3 py-1 rounded flex justify-between items-center font-bold tracking-wider text-[9px]">
                        <span>MODERN MINIMALIST INVOICE</span>
                        <span className="mono">#089</span>
                      </div>
                      <div className="px-1 text-muted-foreground space-y-0.5 text-[9px]">
                        <div className="flex justify-between"><span>Contemporary Service Billing</span><span>₹4,484.00</span></div>
                      </div>
                      <div className="bg-blue-500/10 px-2 py-1 rounded flex justify-between font-black text-blue-600 text-[9px]">
                        <span>GRAND TOTAL</span>
                        <span className="mono">₹4,484.00</span>
                      </div>
                    </div>
                  )}

                  {selectedTemplate.id === 'pos-thermal' && (
                    <div className="h-full flex flex-col items-center justify-between text-center font-mono text-[8.5px]">
                      <div className="border-b border-dashed border-border w-full pb-0.5 font-bold">
                        *** RETAIL RECEIPT POS ***
                      </div>
                      <div className="w-full flex justify-between text-muted-foreground text-[8px]">
                        <span>ITEM x2</span>
                        <span>₹415.00</span>
                      </div>
                      <div className="w-full border-t border-dashed border-border pt-0.5 flex justify-between font-black text-foreground text-[9px]">
                        <span>TOTAL PAID</span>
                        <span>₹415.00</span>
                      </div>
                    </div>
                  )}

                  {selectedTemplate.id === 'executive' && (
                    <div className="h-full flex flex-col justify-between border-2 border-double border-amber-500/40 p-1.5 rounded bg-amber-500/5 text-[8.5px]">
                      <div className="text-center font-serif font-black text-amber-600 tracking-widest border-b border-amber-500/30 pb-0.5">
                        CLASSIC EXECUTIVE CONTRACT
                      </div>
                      <div className="flex justify-between items-center bg-amber-500/10 p-1 rounded font-bold text-amber-800 dark:text-amber-200">
                        <span>Authorized Contract Total</span>
                        <span className="mono font-black">₹25,000.00</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CATEGORY 1: GENERAL / NON-GST TEMPLATES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={15} className="text-primary" />
                    1. General / Non-GST Templates (Select 1 for Non-GST Invoices)
                  </span>
                  <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/25">
                    Non-GST Category
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {INVOICE_TEMPLATES.filter(t => t.id === 'modern' || t.id === 'pos-thermal' || t.id === 'executive').map((tpl) => {
                    const isNonGstSelected = (settings.nongst_template_id || 'modern') === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSettings({ ...settings, nongst_template_id: tpl.id as any, template_id: tpl.id as any })}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                          isNonGstSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-md'
                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h5 className="font-extrabold text-foreground text-sm">{tpl.name}</h5>
                            <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${tpl.badgeColor}`}>
                              {tpl.badge}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-primary mt-0.5">{tpl.tagline}</p>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{tpl.desc}</p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                          <span><strong className="text-foreground">Best for:</strong> {tpl.bestFor}</span>
                          {isNonGstSelected && <span className="font-black text-primary flex items-center gap-1"><Check size={13} /> Active Non-GST Template</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CATEGORY 2: GST / TAX TEMPLATES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-emerald-500/40 pb-1.5">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    2. GST / Tax Templates (Select 1 for GST Invoices)
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    GST Category
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {INVOICE_TEMPLATES.filter(t => t.id === 'gst-pro' || t.id === 'standard').map((tpl) => {
                    const isGstSelected = (settings.gst_template_id || 'gst-pro') === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSettings({ ...settings, gst_template_id: tpl.id as any, template_id: tpl.id as any })}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                          isGstSelected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-md'
                            : 'border-border bg-card hover:border-emerald-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h5 className="font-extrabold text-foreground text-sm">{tpl.name}</h5>
                            <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${tpl.badgeColor}`}>
                              {tpl.badge}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{tpl.tagline}</p>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{tpl.desc}</p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                          <span><strong className="text-foreground">Best for:</strong> {tpl.bestFor}</span>
                          {isGstSelected && <span className="font-black text-emerald-600 flex items-center gap-1"><Check size={13} /> Active GST Template</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRINT PAGE SIZES */}
          {activeTab === 'sizes' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">Select Print Page Size (Paper Format)</h4>
                  <p className="text-xs text-muted-foreground">Sets the default page dimensions, font scaling, and margin constraints when printing or downloading PDFs.</p>
                </div>
                <div className="text-xs font-bold text-primary">
                  Selected: <span className="underline">{selectedPrintSize.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {PRINT_SIZES.map((size) => {
                  const isSelected = settings.print_size === size.id;
                  const Icon = size.icon;
                  return (
                    <div
                      key={size.id}
                      onClick={() => setSettings({ ...settings, print_size: size.id })}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-md'
                          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`grid h-10 w-10 place-items-center rounded-xl ${
                            isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Icon size={20} />
                          </div>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
                            {size.tag}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <h5 className="font-extrabold text-foreground text-sm">{size.name}</h5>
                          {isSelected ? (
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                              <Check size={12} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="h-5 w-5 rounded-full border border-border" />
                          )}
                        </div>

                        <p className="text-[11px] font-mono font-bold text-primary mt-1">{size.dimensions}</p>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{size.desc}</p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Print Ratio:</span>
                        <span className="font-mono font-bold text-foreground">
                          {size.id === 'A4' ? '1 : 1.41 (Full)' : size.id === 'A5' ? '1 : 1.41 (Half)' : size.id === '80mm' ? '3-inch Roll' : size.id === '58mm' ? '2-inch Roll' : '8.5 × 11 in'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Applies instantly across Invoices, Print dialogs & PDF downloads.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-1/2 sm:w-auto btn-primary flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold shadow-xs"
            >
              {saving ? (
                <span>Saving...</span>
              ) : savedSuccess ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Apply & Save Template</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
