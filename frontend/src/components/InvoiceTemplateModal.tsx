import React, { useState, useEffect } from 'react';
import {
  X, Check, Printer, FileText, LayoutTemplate,
  Smartphone, CheckCircle2, Layers, Palette, Eye,
  Crown, Cpu, Sparkles, Building2, Ticket, ShieldCheck,
  Landmark, QrCode
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth, supabase } from '@/lib/api';
import { useScrollReset, useBodyScrollLock } from '@/lib/useScrollReset';

export type InvoiceTemplateId =
  | 'standard'
  | 'modern'
  | 'gst-pro'
  | 'pos-thermal'
  | 'executive'
  | 'royalty-gold'
  | 'cyber-tech'
  | 'b2b-enterprise'
  | 'chic-boutique'
  | 'compact-slip';

export interface InvoiceTemplateSettings {
  template_id: InvoiceTemplateId;
  gst_template_id?: InvoiceTemplateId;
  nongst_template_id?: InvoiceTemplateId;
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
  // GST CATEGORY
  {
    id: 'gst-pro' as const,
    category: 'gst' as const,
    name: 'GST Tax Pro (Compliance)',
    tagline: 'Full Tax Audit & Government Standard',
    badge: 'GST Ready',
    badgeColor: 'bg-emerald-600 text-white',
    desc: 'Detailed HSN/SAC code table, split CGST + SGST or IGST columns, reverse charge flag, state code, and prominent UPI QR code.',
    bestFor: 'GST Registered Merchants, Manufacturers & Distributors',
  },
  {
    id: 'standard' as const,
    category: 'gst' as const,
    name: 'Standard Commercial',
    tagline: 'Clean & Structured Corporate Layout',
    badge: 'Most Popular',
    badgeColor: 'bg-primary text-white',
    desc: 'Professional dual-column header, GSTIN badge, structured itemized table, subtotal breakdown, and dedicated bank transfer block.',
    bestFor: 'General Retail, Wholesale & Commercial Traders',
  },
  {
    id: 'b2b-enterprise' as const,
    category: 'gst' as const,
    name: 'Enterprise B2B Corporate',
    tagline: 'Multi-Tax Audit, PO & Shipping Matrix',
    badge: 'B2B Corporate',
    badgeColor: 'bg-purple-600 text-white',
    desc: 'Multi-column enterprise table with Purchase Order (PO) ref, Shipping vs Billing address matrix, tax split grid, terms & dual sign-off.',
    bestFor: 'Corporate Suppliers, B2B Wholesalers, Exporters & Large Distributors',
  },

  // GENERAL / NON-GST CATEGORY
  {
    id: 'modern' as const,
    category: 'nongst' as const,
    name: 'Modern Minimalist',
    tagline: 'Sleek Borderless Contemporary Design',
    badge: 'Modern',
    badgeColor: 'bg-blue-600 text-white',
    desc: 'High-contrast dark title banner, clean borderless rows, bold typography accents, and spacious visual hierarchy.',
    bestFor: 'Boutiques, Tech Stores, Agencies & Consultancies',
  },
  {
    id: 'pos-thermal' as const,
    category: 'nongst' as const,
    name: 'Compact Thermal POS',
    tagline: 'High-Speed Receipt Layout',
    badge: 'Thermal POS',
    badgeColor: 'bg-cyan-600 text-white',
    desc: 'Optimized for high-speed thermal printers (58mm/80mm) with center store header, dashed line dividers, item x price summary, and bottom barcode.',
    bestFor: 'Supermarkets, Kirana Stores, Bakeries & Quick Counters',
  },
  {
    id: 'executive' as const,
    category: 'nongst' as const,
    name: 'Classic Executive',
    tagline: 'Formal Letterhead & Stamp Border',
    badge: 'Executive',
    badgeColor: 'bg-amber-600 text-white',
    desc: 'Double-line decorative framed border, formal authorized signatory box with digital seal placeholder, and classic typography.',
    bestFor: 'High-Value Invoicing, Legal, Engineering & Corporate Contracts',
  },
  {
    id: 'royalty-gold' as const,
    category: 'nongst' as const,
    name: 'Elegant Royalty (Gold Edition)',
    tagline: 'Luxury Gold Accent & Serif Elegance',
    badge: 'Royalty Gold',
    badgeColor: 'bg-amber-500 text-slate-950 font-black',
    desc: 'Opulent golden header accent, elegant serif typography, refined gold-pinstriped item cards, and premium signature badge.',
    bestFor: 'Jewelry Showrooms, Luxury Fashion, Artisanal Brands & Premium Retail',
  },
  {
    id: 'cyber-tech' as const,
    category: 'nongst' as const,
    name: 'Cyber Tech (Neon Minimalist)',
    tagline: 'Dark-Mode Monospace & Terminal Accents',
    badge: 'Cyber Tech',
    badgeColor: 'bg-indigo-600 text-white',
    desc: 'Futuristic high-tech layout with tech status badges, code-style item tables, dark title bar, and crisp barcode footer.',
    bestFor: 'IT Agencies, Software Companies, Electronics Shops & Tech Repair',
  },
  {
    id: 'chic-boutique' as const,
    category: 'nongst' as const,
    name: 'Chic Boutique (Pastel Clean)',
    tagline: 'Soft Pastel Aesthetic & Clean Lines',
    badge: 'Chic Boutique',
    badgeColor: 'bg-rose-500 text-white',
    desc: 'Gentle rose-tinted header, curved pill badges, clean open spacing, and soft modern typography.',
    bestFor: 'Beauty Salons, Apparel Boutiques, Bakeries & Lifestyle Stores',
  },
  {
    id: 'compact-slip' as const,
    category: 'nongst' as const,
    name: 'Compact Voucher Slip (A5)',
    tagline: 'Fast Counter Voucher & Dispatch Slip',
    badge: 'Voucher Slip',
    badgeColor: 'bg-teal-600 text-white',
    desc: 'Dual-column half-page voucher structure optimized for quick counter billing, dispatch slips, and duplicate bill books.',
    bestFor: 'Distributors, Warehouse Dispatch & Fast Retail Slips',
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
  useBodyScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<'templates' | 'sizes'>('templates');
  const [previewModalTemplate, setPreviewModalTemplate] = useState<InvoiceTemplateId | null>(null);

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
      toast.success('Invoice template settings saved successfully!');
      if (onSaved) onSaved(settings);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('Error saving template settings:', err);
      toast.error('Failed to save invoice template settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectedTemplate = INVOICE_TEMPLATES.find(t => t.id === settings.template_id) || INVOICE_TEMPLATES[0];
  const selectedPrintSize = PRINT_SIZES.find(s => s.id === settings.print_size) || PRINT_SIZES[0];

  // Render Vertical A4 Paper Sheet Mini Visual Document Preview
  const renderCardMiniPreview = (tplId: string) => {
    return (
      <div className="w-full bg-slate-900/5 dark:bg-slate-950/40 py-3.5 px-2 rounded-xl border border-border/80 flex items-center justify-center min-h-[235px] shadow-inner relative overflow-hidden group/preview">
        {/* Vertical A4 Paper Sheet Container (Aspect Ratio 1 : 1.387) */}
        <div className="w-[155px] h-[215px] bg-white text-slate-900 rounded-xs shadow-lg border border-slate-200/90 p-2.5 flex flex-col justify-between text-[6.5px] font-sans leading-tight relative transition-transform duration-300 group-hover/preview:scale-[1.03] select-none">
          
          {/* GST TAX PRO */}
          {tplId === 'gst-pro' && (
            <>
              <div className="border-b border-emerald-600 pb-1 flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-emerald-800 text-[7.5px] flex items-center gap-0.5"><ShieldCheck size={8} /> GST TAX INVOICE</div>
                  <div className="text-[6px] text-slate-500 font-bold">GSTIN: 19ABCDE1234F1Z5</div>
                </div>
                <div className="text-right text-[6px]">
                  <div className="font-bold text-emerald-700">#INV-9901</div>
                  <div className="text-slate-400">19-WB</div>
                </div>
              </div>
              <div className="bg-emerald-50/70 p-1 rounded text-[5.5px] text-slate-600 flex justify-between">
                <div><strong>Billed To:</strong> Apex Traders</div>
                <div className="text-right font-bold text-emerald-700">VERIFIED</div>
              </div>
              <div className="border border-slate-200 rounded overflow-hidden">
                <div className="bg-emerald-600 text-white font-bold px-1 py-0.5 flex justify-between text-[5.5px]">
                  <span>Item</span><span>HSN</span><span>CGST+SGST</span><span>Total</span>
                </div>
                <div className="p-1 space-y-0.5 text-slate-700 text-[5.5px]">
                  <div className="flex justify-between"><span>Commercial Goods</span><span>8471</span><span>18%</span><span>₹7,500</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-0.5"><span>Logistics Charge</span><span>9965</span><span>18%</span><span>₹1,420</span></div>
                </div>
              </div>
              <div className="bg-emerald-500/10 p-1 rounded flex justify-between font-black text-emerald-800 text-[7px] border border-emerald-500/20">
                <span>TOTAL INCL. TAX</span>
                <span className="mono">₹8,920.00</span>
              </div>
              <div className="flex justify-between items-end text-[5.5px] text-slate-400 border-t border-slate-200 pt-0.5">
                <span className="flex items-center gap-0.5"><QrCode size={7} /> UPI: bmm@upi</span>
                <span>Auth Seal ✓</span>
              </div>
            </>
          )}

          {/* STANDARD COMMERCIAL */}
          {tplId === 'standard' && (
            <>
              <div className="border-b border-orange-500 pb-1 flex justify-between items-start">
                <div>
                  <div className="font-black text-orange-600 text-[8px]">BILLINGMASTER STORE</div>
                  <div className="text-[6px] text-slate-400">Commercial Trading</div>
                </div>
                <div className="text-right text-[6px]">
                  <div className="font-bold text-slate-700">INV-2026-001</div>
                  <div className="text-slate-400">07-Sep-2026</div>
                </div>
              </div>
              <div className="bg-slate-50 p-1 rounded text-[5.5px] text-slate-600">
                <div><strong>Billed To:</strong> Retail Customer</div>
              </div>
              <div className="border border-slate-200 rounded">
                <div className="bg-slate-100 text-slate-700 font-bold px-1 py-0.5 flex justify-between text-[5.5px]">
                  <span>Item</span><span>Qty</span><span>Rate</span><span>Amount</span>
                </div>
                <div className="p-1 space-y-0.5 text-[5.5px]">
                  <div className="flex justify-between"><span>Retail Product A</span><span>2</span><span>₹1,250</span><span>₹2,500</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-0.5"><span>Retail Product B</span><span>1</span><span>₹1,750</span><span>₹1,750</span></div>
                </div>
              </div>
              <div className="bg-orange-50 p-1 rounded flex justify-between font-black text-orange-700 text-[7px] border border-orange-200">
                <span>SUBTOTAL + TAX</span>
                <span className="mono">₹4,250.00</span>
              </div>
              <div className="flex justify-between items-end text-[5.5px] text-slate-400 border-t border-slate-200 pt-0.5">
                <span>HDFC Bank: 50100234..</span>
                <span>Authorized Signatory</span>
              </div>
            </>
          )}

          {/* B2B ENTERPRISE */}
          {tplId === 'b2b-enterprise' && (
            <>
              <div className="bg-purple-700 text-white p-1 rounded-xs flex justify-between items-center font-bold text-[6.5px]">
                <span className="flex items-center gap-0.5"><Building2 size={7} /> B2B ENTERPRISE</span>
                <span className="mono text-[5.5px]">PO #: PO-99214</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[5.5px] bg-purple-50/70 p-1 rounded border border-purple-200">
                <div><strong>Billed:</strong> Corporate Client</div>
                <div><strong>Shipped:</strong> Logistics Hub</div>
              </div>
              <div className="border border-purple-200 rounded text-[5.5px]">
                <div className="bg-purple-100 text-purple-900 font-bold px-1 py-0.5 flex justify-between">
                  <span>Description</span><span>Tax Grid</span><span>Audit Total</span>
                </div>
                <div className="p-1 space-y-0.5 text-slate-700">
                  <div className="flex justify-between"><span>Bulk Shipment Alpha</span><span>CGST+SGST</span><span>₹48,500</span></div>
                </div>
              </div>
              <div className="bg-purple-600 text-white p-1 rounded flex justify-between font-black text-[7px]">
                <span>AUDITED B2B TOTAL</span>
                <span className="mono">₹48,500.00</span>
              </div>
              <div className="flex justify-between items-end text-[5.5px] text-slate-400 border-t border-slate-200 pt-0.5">
                <span>Payment: Net 15 Days</span>
                <span className="font-bold text-purple-900">Corporate Seal ✓</span>
              </div>
            </>
          )}

          {/* MODERN MINIMALIST */}
          {tplId === 'modern' && (
            <>
              <div className="bg-slate-900 text-white p-1.5 rounded-xs flex justify-between items-center font-bold">
                <span className="text-[7.5px] tracking-wider">MODERN MINIMALIST</span>
                <span className="mono text-[6px] text-blue-400">#089</span>
              </div>
              <div className="text-[5.5px] text-slate-500 py-0.5">Contemporary Tech & Design Consulting</div>
              <div className="space-y-1 text-[5.5px] text-slate-700 py-1">
                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span>Web & Software Design</span><span>₹4,000</span></div>
                <div className="flex justify-between"><span>Cloud Server Hosting</span><span>₹484</span></div>
              </div>
              <div className="bg-blue-500/10 p-1 rounded flex justify-between font-black text-blue-600 text-[7px] border border-blue-200">
                <span>GRAND TOTAL</span>
                <span className="mono">₹4,484.00</span>
              </div>
              <div className="text-[5.5px] text-slate-400 text-right border-t border-slate-200 pt-0.5">
                Minimalist Clean Format
              </div>
            </>
          )}

          {/* COMPACT THERMAL POS */}
          {tplId === 'pos-thermal' && (
            <div className="h-full bg-slate-50 text-slate-900 font-mono p-1 border-y-2 border-dashed border-slate-400 flex flex-col justify-between text-[6px] shadow-2xs">
              <div className="text-center border-b border-dashed border-slate-300 pb-0.5 font-bold">
                *** RETAIL COUNTER MEMO ***
              </div>
              <div className="space-y-0.5 py-1 text-[5.5px]">
                <div className="flex justify-between"><span>ITEM A x1</span><span>₹200.00</span></div>
                <div className="flex justify-between"><span>ITEM B x1</span><span>₹215.00</span></div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-0.5 flex justify-between font-black text-[7px]">
                <span>TOTAL PAID</span>
                <span>₹415.00</span>
              </div>
              <div className="text-center text-[5px] text-slate-400 pt-0.5">||||||||||||||||||||||||||||</div>
            </div>
          )}

          {/* CLASSIC EXECUTIVE */}
          {tplId === 'executive' && (
            <div className="h-full border-4 border-double border-amber-600/60 p-1.5 flex flex-col justify-between text-[6px]">
              <div className="text-center font-serif font-black text-amber-800 text-[7.5px] tracking-widest border-b border-amber-600/30 pb-0.5">
                OFFICIAL CONTRACT INVOICE
              </div>
              <div className="text-slate-500 text-[5.5px] space-y-0.5 py-1">
                <div className="flex justify-between"><span>Legal Contract & Fees</span><span>₹25,000</span></div>
              </div>
              <div className="bg-amber-500/15 p-1 rounded font-bold text-amber-900 flex justify-between text-[7px]">
                <span>Contract Total</span>
                <span className="mono font-black">₹25,000.00</span>
              </div>
              <div className="text-right text-[5px] text-amber-800 font-serif font-bold">
                Formal Authorized Seal ✍️
              </div>
            </div>
          )}

          {/* ELEGANT ROYALTY GOLD */}
          {tplId === 'royalty-gold' && (
            <>
              <div className="border-t-2 border-amber-500 pt-1 border-b border-amber-300/60 pb-1 flex justify-between items-center">
                <span className="font-serif font-black text-amber-800 text-[7.5px] flex items-center gap-0.5"><Crown size={8} /> ROYALTY GOLD</span>
                <span className="mono text-[5.5px] bg-amber-400/20 text-amber-900 px-1 rounded font-bold">LUXURY</span>
              </div>
              <div className="space-y-0.5 text-[5.5px] text-slate-600">
                <div className="flex justify-between border-b border-amber-100 pb-0.5"><span>22k Gold Jewelry</span><span>₹1,25,000</span></div>
              </div>
              <div className="bg-amber-500/20 border border-amber-400/40 p-1 rounded font-black text-amber-900 flex justify-between text-[7px]">
                <span>ROYALTY TOTAL</span>
                <span className="mono">₹1,25,000.00</span>
              </div>
              <div className="text-[5.5px] text-amber-700 font-serif text-right border-t border-amber-200 pt-0.5">
                Artisanal Guarantee Stamp
              </div>
            </>
          )}

          {/* CYBER TECH */}
          {tplId === 'cyber-tech' && (
            <div className="h-full bg-slate-950 text-slate-100 font-mono p-1.5 rounded-xs border border-indigo-500/40 flex flex-col justify-between text-[6px]">
              <div className="flex justify-between items-center border-b border-indigo-500/40 pb-0.5 text-indigo-400 font-bold text-[7px]">
                <span className="flex items-center gap-0.5"><Cpu size={8} /> // CYBER_TECH</span>
                <span className="text-[5px] bg-indigo-500/20 px-1 rounded text-indigo-300">OK</span>
              </div>
              <div className="space-y-0.5 text-slate-400 text-[5.5px]">
                <div className="flex justify-between"><span>&gt; Server Deployment</span><span>₹18,500</span></div>
              </div>
              <div className="bg-indigo-900/40 border border-indigo-500/30 p-1 rounded font-black text-indigo-300 flex justify-between text-[7px]">
                <span>GRAND_TOTAL</span>
                <span>₹18,500.00</span>
              </div>
              <div className="text-[5px] text-indigo-400 text-right">SYSTEM_VERIFIED</div>
            </div>
          )}

          {/* CHIC BOUTIQUE */}
          {tplId === 'chic-boutique' && (
            <>
              <div className="bg-gradient-to-r from-rose-100 to-pink-100 text-rose-900 p-1 rounded-sm border border-rose-200 flex justify-between items-center font-extrabold text-[7.5px]">
                <span className="flex items-center gap-0.5"><Sparkles size={8} /> CHIC BOUTIQUE</span>
                <span className="bg-rose-500/20 text-rose-800 text-[5.5px] px-1 rounded-full">PASTEL</span>
              </div>
              <div className="space-y-0.5 text-[5.5px] text-slate-600">
                <div className="flex justify-between"><span>Designer Apparel</span><span>₹3,800</span></div>
              </div>
              <div className="bg-rose-500/15 p-1 rounded-full px-2 font-black text-rose-800 flex justify-between text-[7px]">
                <span>PAYABLE</span>
                <span className="mono">₹3,800.00</span>
              </div>
              <div className="text-[5.5px] text-rose-600 text-right border-t border-rose-100 pt-0.5">
                Boutique Customer Care
              </div>
            </>
          )}

          {/* COMPACT VOUCHER SLIP */}
          {tplId === 'compact-slip' && (
            <div className="h-full bg-teal-50/80 text-teal-950 p-1.5 rounded-xs border border-teal-300 flex flex-col justify-between text-[6px]">
              <div className="bg-teal-600 text-white p-1 rounded-xs flex justify-between items-center font-bold text-[7px]">
                <span className="flex items-center gap-0.5"><Ticket size={8} /> DISPATCH SLIP</span>
                <span className="mono text-[5.5px]">SLIP-401</span>
              </div>
              <div className="text-[5.5px] space-y-0.5">
                <div className="flex justify-between"><span>Counter Slip Item</span><span>₹1,950</span></div>
              </div>
              <div className="border-t border-dashed border-teal-400 pt-0.5 text-teal-800 font-bold flex justify-between text-[6.5px]">
                <span>CONFIRMED</span>
                <span className="mono">✓ PASS</span>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
      <div className="card-shell w-full max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden animate-rise shadow-2xl border border-border">
        
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
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-foreground">Select Visual Template</h4>
                  <p className="text-xs text-muted-foreground">Realistic vertical A4 sheet preview displayed directly on top of each template card. Click "Full Preview" to view full-screen.</p>
                </div>
                <div className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/25">
                  Active: <span className="underline font-extrabold">{selectedTemplate.name}</span>
                </div>
              </div>

              {/* CATEGORY 1: GST / TAX TEMPLATES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-500/40 pb-1.5">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    1. GST / Tax Templates (Select 1 for Tax Compliant Invoices)
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    GST Category
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {INVOICE_TEMPLATES.filter(t => t.category === 'gst').map((tpl) => {
                    const isGstSelected = (settings.gst_template_id || 'gst-pro') === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSettings({ ...settings, gst_template_id: tpl.id as any, template_id: tpl.id as any })}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          isGstSelected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-md'
                            : 'border-border bg-card hover:border-emerald-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Vertical A4 Paper Sheet Preview on TOP of Card (above title) */}
                          <div className="relative">
                            {renderCardMiniPreview(tpl.id)}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewModalTemplate(tpl.id as any);
                              }}
                              className="absolute top-2 right-2 bg-background/95 hover:bg-emerald-600 hover:text-white text-foreground text-[10px] font-extrabold px-2.5 py-1 rounded-md border border-border shadow-xs flex items-center gap-1 transition-colors cursor-pointer z-10"
                            >
                              <Eye size={12} />
                              <span>Full Preview</span>
                            </button>
                          </div>

                          {/* Template Name & Badge */}
                          <div>
                            <div className="flex items-center justify-between">
                              <h5 className="font-extrabold text-foreground text-sm">{tpl.name}</h5>
                              <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${tpl.badgeColor}`}>
                                {tpl.badge}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">{tpl.tagline}</p>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{tpl.desc}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                          <span className="truncate max-w-[170px]"><strong className="text-foreground">Best for:</strong> {tpl.bestFor}</span>
                          {isGstSelected && <span className="font-black text-emerald-600 flex items-center gap-1 shrink-0"><Check size={13} /> Active GST Template</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CATEGORY 2: GENERAL / NON-GST TEMPLATES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <span className="text-xs font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={16} className="text-primary" />
                    2. General / Non-GST Templates (Select 1 for Non-GST Invoices)
                  </span>
                  <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/25">
                    Non-GST Category
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {INVOICE_TEMPLATES.filter(t => t.category === 'nongst').map((tpl) => {
                    const isNonGstSelected = (settings.nongst_template_id || 'modern') === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSettings({ ...settings, nongst_template_id: tpl.id as any, template_id: tpl.id as any })}
                        className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          isNonGstSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-md'
                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Vertical A4 Paper Sheet Preview on TOP of Card (above title) */}
                          <div className="relative">
                            {renderCardMiniPreview(tpl.id)}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewModalTemplate(tpl.id as any);
                              }}
                              className="absolute top-2 right-2 bg-background/95 hover:bg-primary hover:text-white text-foreground text-[10px] font-extrabold px-2.5 py-1 rounded-md border border-border shadow-xs flex items-center gap-1 transition-colors cursor-pointer z-10"
                            >
                              <Eye size={12} />
                              <span>Full Preview</span>
                            </button>
                          </div>

                          {/* Template Name & Badge */}
                          <div>
                            <div className="flex items-center justify-between">
                              <h5 className="font-extrabold text-foreground text-sm">{tpl.name}</h5>
                              <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${tpl.badgeColor}`}>
                                {tpl.badge}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-primary mt-0.5">{tpl.tagline}</p>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{tpl.desc}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
                          <span className="truncate max-w-[170px]"><strong className="text-foreground">Best for:</strong> {tpl.bestFor}</span>
                          {isNonGstSelected && <span className="font-black text-primary flex items-center gap-1 shrink-0"><Check size={13} /> Active Non-GST</span>}
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
              className="w-1/2 sm:w-auto rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-1/2 sm:w-auto btn-primary flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold shadow-xs cursor-pointer"
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

      {/* FULL-SCREEN HIGH-RES INTERACTIVE PREVIEW MODAL */}
      {previewModalTemplate && (
        <FullHighResPreviewModal
          templateId={previewModalTemplate}
          printSize={settings.print_size}
          onClose={() => setPreviewModalTemplate(null)}
          onApply={(tplId) => {
            const tObj = INVOICE_TEMPLATES.find(t => t.id === tplId);
            if (tObj?.category === 'gst') {
              setSettings({ ...settings, gst_template_id: tplId as any, template_id: tplId as any });
            } else {
              setSettings({ ...settings, nongst_template_id: tplId as any, template_id: tplId as any });
            }
            setPreviewModalTemplate(null);
            toast.success(`Selected ${tObj?.name || 'Template'} as active template!`);
          }}
        />
      )}
    </div>
  );
}

// FULL HIGH-RES PREVIEW MODAL COMPONENT
interface FullHighResPreviewModalProps {
  templateId: InvoiceTemplateId;
  printSize: string;
  onClose: () => void;
  onApply: (templateId: InvoiceTemplateId) => void;
}

function FullHighResPreviewModal({ templateId, printSize, onClose, onApply }: FullHighResPreviewModalProps) {
  const [activeTpl, setActiveTpl] = useState<InvoiceTemplateId>(templateId);
  const tplInfo = INVOICE_TEMPLATES.find(t => t.id === activeTpl) || INVOICE_TEMPLATES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[95vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-rise">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border bg-muted/30 gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-black">
              <Eye size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-foreground">{tplInfo.name}</h4>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${tplInfo.badgeColor}`}>
                  {tplInfo.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{tplInfo.tagline} • Print Format: <strong className="text-foreground">{printSize}</strong></p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={activeTpl}
              onChange={(e) => setActiveTpl(e.target.value as any)}
              className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-foreground"
            >
              {INVOICE_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.category.toUpperCase()})</option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable High-Res Invoice Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900/10 dark:bg-slate-950/40 flex justify-center">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 p-6 sm:p-8 text-xs font-sans space-y-6">
            
            {/* Render distinct preview styles based on activeTpl */}
            {activeTpl === 'royalty-gold' && (
              <div className="border-t-4 border-amber-500 pt-2">
                <div className="flex justify-between items-start border-b border-amber-300/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2 font-serif text-xl font-black text-amber-800">
                      <Crown size={22} className="text-amber-500" />
                      ROYALTY JEWELERS & LUXURY BOUTIQUE
                    </div>
                    <p className="text-[11px] text-slate-600">12 Heritage Court, Park Street, Kolkata • GSTIN: 19AAACR9981F1Z2</p>
                  </div>
                  <div className="text-right">
                    <div className="font-serif font-black text-amber-700 text-sm">LUXURY INVOICE</div>
                    <div className="mono font-bold text-slate-700">#RYL-2026-904</div>
                    <div className="text-[10px] text-slate-500">Date: 07-Sep-2026</div>
                  </div>
                </div>
              </div>
            )}

            {activeTpl === 'cyber-tech' && (
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono">
                <div className="flex justify-between items-center border-b border-indigo-500/50 pb-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    <Cpu size={18} /> CYBER_TECH SYSTEMS & SOFTWARE
                  </div>
                  <span className="bg-indigo-500/30 text-indigo-300 text-[10px] px-2 py-0.5 rounded">COMMERCIAL_VERIFIED</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                  <span>CLIENT: DEV_CORP_GLOBAL</span>
                  <span>ID: #SYS-88402</span>
                </div>
              </div>
            )}

            {activeTpl === 'gst-pro' && (
              <div className="border-b-2 border-emerald-600 pb-3 flex justify-between items-center">
                <div>
                  <div className="text-base font-black text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck size={18} /> GST TAX INVOICE (FULL COMPLIANCE)
                  </div>
                  <p className="text-[11px] text-slate-600 font-bold">BillingMaster Wholesale Ltd • GSTIN: 19ABCDE1234F1Z5</p>
                </div>
                <div className="text-right bg-emerald-50 p-2 rounded border border-emerald-200">
                  <div className="font-extrabold text-emerald-800 text-xs">INV-2026-00412</div>
                  <div className="text-[10px] text-emerald-600">State Code: 19 (West Bengal)</div>
                </div>
              </div>
            )}

            {activeTpl === 'b2b-enterprise' && (
              <div className="border-2 border-purple-600 p-3 rounded-lg bg-purple-50/50">
                <div className="flex justify-between items-center border-b border-purple-300 pb-2">
                  <div>
                    <div className="font-extrabold text-purple-900 text-base flex items-center gap-1.5"><Building2 size={18} /> B2B ENTERPRISE AUDIT INVOICE</div>
                    <div className="text-[10px] text-purple-700 font-semibold">Supply Chain & Corporate Logistics Division</div>
                  </div>
                  <div className="text-right font-mono text-purple-900 font-bold">PO #: PO-2026-88192</div>
                </div>
              </div>
            )}

            {activeTpl === 'chic-boutique' && (
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-4 rounded-xl border border-rose-200">
                <div className="flex justify-between items-center">
                  <div className="font-extrabold text-rose-700 text-base flex items-center gap-1.5"><Sparkles size={18} /> CHIC BOUTIQUE & APPAREL</div>
                  <span className="bg-rose-200 text-rose-800 text-[10px] font-extrabold px-3 py-1 rounded-full">INV #CB-994</span>
                </div>
              </div>
            )}

            {activeTpl === 'executive' && (
              <div className="border-4 border-double border-amber-600/60 p-3 rounded">
                <div className="text-center font-serif font-black text-amber-800 text-base tracking-widest border-b border-amber-600/30 pb-2">
                  OFFICIAL EXECUTIVE CONTRACT INVOICE
                </div>
              </div>
            )}

            {activeTpl === 'pos-thermal' && (
              <div className="font-mono text-center border-y-2 border-dashed border-slate-400 py-2 space-y-1">
                <div className="font-black text-sm">*** RETAIL STORE COUNTER RECEIPT ***</div>
                <div className="text-[10px] text-slate-600">Tel: +91 98765 43210 • Reg: #8841</div>
              </div>
            )}

            {activeTpl === 'compact-slip' && (
              <div className="bg-teal-50 p-3 rounded-lg border border-teal-300 flex justify-between items-center font-bold text-teal-900">
                <span className="flex items-center gap-1.5"><Ticket size={16} /> COUNTER DISPATCH VOUCHER (A5)</span>
                <span className="mono">VOUCHER #SLIP-4012</span>
              </div>
            )}

            {activeTpl === 'modern' && (
              <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between items-center font-bold">
                <div>
                  <div className="text-base tracking-wider">MODERN MINIMALIST INVOICE</div>
                  <div className="text-xs text-blue-400">Contemporary Tech & Digital Services</div>
                </div>
                <div className="mono text-lg text-blue-400">#INV-8890</div>
              </div>
            )}

            {activeTpl === 'standard' && (
              <div className="flex justify-between items-start border-b border-slate-300 pb-3">
                <div>
                  <div className="text-lg font-black text-orange-600">BILLINGMASTER COMMERCIAL STORE</div>
                  <p className="text-slate-500 text-[11px]">Commercial Trading & Retail Outlet</p>
                </div>
                <div className="text-right">
                  <div className="mono font-bold text-slate-800 text-sm">INV-2026-00108</div>
                  <div className="text-slate-500 text-[10px]">Date: 07-Sep-2026</div>
                </div>
              </div>
            )}

            {/* Billed To / Shipping Address */}
            <div className="grid grid-cols-2 gap-4 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">BILLED TO</span>
                <div className="font-bold text-slate-900">Royal Handicrafts Pvt Ltd</div>
                <div className="text-[11px] text-slate-600">Attn: Rajesh Verma (+91 91234 56789)</div>
                <div className="text-[11px] text-slate-600">45 MG Road, Suite 302, Kolkata, WB</div>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">INVOICE DETAILS</span>
                <div className="text-[11px]"><strong>Payment Terms:</strong> Net 15 Days</div>
                <div className="text-[11px]"><strong>Place of Supply:</strong> West Bengal (19)</div>
                <div className="text-[11px] text-emerald-700 font-bold mt-1">Status: ✅ PAID ONLINE</div>
              </div>
            </div>

            {/* Sample Item Table */}
            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase text-slate-600">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 text-center">HSN</th>
                    <th className="p-2 text-center w-12">Qty</th>
                    <th className="p-2 text-right">Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  <tr>
                    <td className="p-2 text-center font-bold text-slate-400">1</td>
                    <td className="p-2 font-bold text-slate-800">Premium Artisanal Silk Saree</td>
                    <td className="p-2 text-center mono text-slate-500">5007</td>
                    <td className="p-2 text-center font-bold">2 pcs</td>
                    <td className="p-2 text-right mono">₹4,500.00</td>
                    <td className="p-2 text-right mono font-bold">₹9,000.00</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold text-slate-400">2</td>
                    <td className="p-2 font-bold text-slate-800">Handcrafted Silver Photo Frame</td>
                    <td className="p-2 text-center mono text-slate-500">7114</td>
                    <td className="p-2 text-center font-bold">1 pc</td>
                    <td className="p-2 text-right mono">₹3,200.00</td>
                    <td className="p-2 text-right mono font-bold">₹3,200.00</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-center font-bold text-slate-400">3</td>
                    <td className="p-2 font-bold text-slate-800">Decorative Brass Diya Gift Set</td>
                    <td className="p-2 text-center mono text-slate-500">7419</td>
                    <td className="p-2 text-center font-bold">3 pcs</td>
                    <td className="p-2 text-right mono">₹850.00</td>
                    <td className="p-2 text-right mono font-bold">₹2,550.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calculations & Bank Transfer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1 mb-1"><Landmark size={12} className="text-slate-600" /> BANK TRANSFER & UPI</div>
                <div><strong>UPI ID:</strong> billingmaster@upi</div>
                <div><strong>Bank:</strong> HDFC Bank Ltd</div>
                <div><strong>A/C No:</strong> 50100234567890 (IFSC: HDFC0001234)</div>
              </div>

              <div className="space-y-1 text-right bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span className="mono font-bold text-slate-800">₹14,750.00</span></div>
                <div className="flex justify-between text-slate-600"><span>CGST (9%):</span><span className="mono font-bold text-slate-800">₹1,327.50</span></div>
                <div className="flex justify-between text-slate-600"><span>SGST (9%):</span><span className="mono font-bold text-slate-800">₹1,327.50</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-1.5 font-black text-slate-900 text-sm">
                  <span>Grand Total:</span>
                  <span className="mono text-orange-600 font-extrabold text-base">₹17,405.00</span>
                </div>
              </div>
            </div>

            {/* Signature & Seal */}
            <div className="flex justify-between items-end border-t border-slate-200 pt-4 text-[10px] text-slate-500">
              <div>Computer Generated Tax Invoice. Thank you for doing business with us!</div>
              <div className="text-center">
                <div className="border-b border-slate-400 w-28 mb-1" />
                <div className="font-bold text-slate-800">Authorized Signatory & Seal</div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Like this design? Click apply to set it as your active invoice template.
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => onApply(activeTpl)}
              className="btn-primary rounded-xl px-6 py-2 text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} className="stroke-[3]" />
              <span>Select & Apply This Template</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
