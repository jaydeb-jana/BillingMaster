import { useState, useEffect } from 'react';
import {
  HelpCircle, Gift, Settings as SettingsIcon, UserCog,
  Trash2, Search, Printer, Star, Info, ChevronRight,
  ShieldCheck, Bell, CreditCard, FileText, CheckCircle2,
  Share2, ArrowLeft, X, Smartphone, Plus, RefreshCw,
  Copy, Check, AlertTriangle, ExternalLink, RotateCcw,
  Sliders, MessageSquare, Send, Building2, Mail,
  Receipt, Calendar, CalendarDays, CalendarRange, TrendingUp,
  BarChart3, Layers, Users, Package, Box, Filter, LayoutTemplate,
  FileSpreadsheet, History as HistoryIcon
} from 'lucide-react';
import { db, auth, getBusinessId } from '@/lib/api';
import { useScrollReset, resetScrollRef, useBodyScrollLock } from '@/lib/useScrollReset';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { HelpCenterModal } from '@/components/HelpCenterModal';
import {
  InvoiceTemplateModal,
  InvoiceTemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS,
  INVOICE_TEMPLATES,
  PRINT_SIZES
} from '@/components/InvoiceTemplateModal';
import { CATaxExportModal } from '@/components/CATaxExportModal';

interface MoreHubProps {
  onNavigate?: (path: string) => void;
}

export interface DeletedItem {
  id: string;
  type: 'customer' | 'product' | 'invoice';
  title: string;
  subtitle: string;
  extraInfo?: string;
  deleted_at: string;
}

export const SAMPLE_RECYCLE_BIN_ITEMS: DeletedItem[] = [
  // Invoices
  {
    id: 'del-inv-1',
    type: 'invoice',
    title: 'INV-2026-089',
    subtitle: 'Apex Retail Mart • Total ₹8,450',
    extraInfo: '4 items • Paid via UPI',
    deleted_at: '2026-08-29 16:45'
  },
  {
    id: 'del-inv-2',
    type: 'invoice',
    title: 'INV-2026-088',
    subtitle: 'Metro Supermarket • Total ₹4,200',
    extraInfo: '3 items • Paid via UPI',
    deleted_at: '2026-08-29 14:20'
  },
  {
    id: 'del-inv-3',
    type: 'invoice',
    title: 'INV-2026-084',
    subtitle: 'City Traders • Total ₹1,850',
    extraInfo: '2 items • Cash Payment',
    deleted_at: '2026-08-26 11:05'
  },
  {
    id: 'del-inv-4',
    type: 'invoice',
    title: 'INV-2026-079',
    subtitle: 'Sunrise General Store • Total ₹12,600',
    extraInfo: '8 items • Net Banking Transfer',
    deleted_at: '2026-08-22 18:30'
  },
  // Customers
  {
    id: 'del-cust-1',
    type: 'customer',
    title: 'Rajesh Kumar Enterprise',
    subtitle: '+91 98234 11223 • Connaught Place, New Delhi',
    extraInfo: 'GSTIN: 07AAAAA0000A1Z5 • Khata Due: ₹3,400',
    deleted_at: '2026-08-28 17:15'
  },
  {
    id: 'del-cust-2',
    type: 'customer',
    title: 'Anita Sharma',
    subtitle: '+91 97112 33445 • Sector 14, Gurgaon',
    extraInfo: 'Retail Customer • Khata Due: ₹0.00',
    deleted_at: '2026-08-25 09:30'
  },
  {
    id: 'del-cust-3',
    type: 'customer',
    title: 'Vikas General Store',
    subtitle: '+91 98110 55443 • Karol Bagh, New Delhi',
    extraInfo: 'Retail Store • Khata Due: ₹1,850',
    deleted_at: '2026-08-24 12:10'
  },
  {
    id: 'del-cust-4',
    type: 'customer',
    title: 'Pooja Sweets & Bakery',
    subtitle: '+91 99201 88776 • Andheri West, Mumbai',
    extraInfo: 'Wholesale Client • Khata Due: ₹6,200',
    deleted_at: '2026-08-21 14:40'
  },
  // Products
  {
    id: 'del-prod-1',
    type: 'product',
    title: 'Fortune Sunlite Sunflower Oil 1L',
    subtitle: 'Edible Oils • MRP ₹175.00',
    extraInfo: 'Barcode: 8901030382910 • Stock: 24 PCS',
    deleted_at: '2026-08-28 11:40'
  },
  {
    id: 'del-prod-2',
    type: 'product',
    title: 'Aashirvaad Superior MP Sharbati Atta 5kg',
    subtitle: 'Flour & Grains • MRP ₹340.00',
    extraInfo: 'Barcode: 8901725181234 • Stock: 12 Bags',
    deleted_at: '2026-08-24 15:50'
  },
  {
    id: 'del-prod-3',
    type: 'product',
    title: 'Tata Salt Vacuum Evaporated 1kg',
    subtitle: 'Spices & Essentials • MRP ₹28.00',
    extraInfo: 'Barcode: 8901058852277 • Stock: 50 PCS',
    deleted_at: '2026-08-23 10:15'
  },
  {
    id: 'del-prod-4',
    type: 'product',
    title: 'Cadbury Dairy Milk Silk Chocolate 150g',
    subtitle: 'Confectionery • MRP ₹180.00',
    extraInfo: 'Barcode: 7622201498112 • Stock: 35 PCS',
    deleted_at: '2026-08-20 16:25'
  }
];

export function MoreHub({ onNavigate }: MoreHubProps) {
  const [, setLocation] = useLocation();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  useScrollReset(activeModal);

  const [business, setBusiness] = useState<any | null>(null);
  
  // Invoice Template & Print Setup State
  const [templateSettings, setTemplateSettings] = useState<InvoiceTemplateSettings>(() => {
    try {
      const saved = localStorage.getItem('arventa_invoice_template_settings');
      if (saved) {
        return { ...DEFAULT_TEMPLATE_SETTINGS, ...JSON.parse(saved) };
      }
      const taxRaw = localStorage.getItem('arventa_tax_settings');
      if (taxRaw) {
        const parsed = JSON.parse(taxRaw);
        return {
          ...DEFAULT_TEMPLATE_SETTINGS,
          template_id: parsed.invoice_template || 'standard',
          print_size: parsed.invoice_print_size || 'A4',
        };
      }
    } catch {}
    return DEFAULT_TEMPLATE_SETTINGS;
  });

  // Recycle Bin State (Customers, Products, Invoices)
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>(() => {
    try {
      const saved = localStorage.getItem('lms_recycle_bin_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  const [recycleFilter, setRecycleFilter] = useState<'all' | 'customer' | 'product' | 'invoice'>('all');
  const [recycleSearch, setRecycleSearch] = useState('');
  const [purgeTargetId, setPurgeTargetId] = useState<string | null>(null);
  const [showEmptyBinConfirm, setShowEmptyBinConfirm] = useState<boolean>(false);

  const [copied, setCopied] = useState(false);
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Billing & Subscription Payment History State
  const [selectedProofItem, setSelectedProofItem] = useState<any | null>(null);
  useBodyScrollLock(Boolean(activeModal || purgeTargetId || showEmptyBinConfirm || selectedProofItem));
  const [billingSearch, setBillingSearch] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('billingmaster_payment_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const fetchLiveBillingHistory = async () => {
    try {
      const bid = (await getBusinessId()) || localStorage.getItem('billingmaster_business_id') || 'biz-01';
      const res = await fetch(`/api/billing-requests/my?business_id=${bid}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const liveItems = json.data.map((req: any) => ({
            id: req.id,
            planName: `${req.requested_plan} Plan Purchase`,
            planPrice: req.price || '₹499',
            utr: req.utr_ref,
            notes: req.admin_response ? `Admin Note: ${req.admin_response}` : (req.utr_ref ? `Submitted UTR: ${req.utr_ref}` : 'Payment screenshot uploaded.'),
            screenshotUrl: req.screenshot_url || '',
            status: req.status === 'accepted' ? 'active_verified' : (req.status === 'rejected' ? 'rejected' : 'pending_verification'),
            adminResponse: req.admin_response,
            timestamp: new Date(req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) + ' at ' + new Date(req.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date: new Date(req.created_at).toISOString().split('T')[0],
            time: new Date(req.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            paymentMethod: 'Direct UPI App',
          }));

          const localItemsRaw = localStorage.getItem('billingmaster_payment_history');
          let mergedItems = [...liveItems];
          if (localItemsRaw) {
            try {
              const localItems = JSON.parse(localItemsRaw);
              if (Array.isArray(localItems)) {
                localItems.forEach((localItem: any) => {
                  if (localItem.id === 'REQ-2026-1001') return;
                  const matchInLive = liveItems.find(
                    (m: any) => m.id === localItem.id || (m.utr && localItem.utr && m.utr === localItem.utr)
                  );
                  if (!matchInLive) {
                    mergedItems.push(localItem);
                  }
                });
              }
            } catch (e) {}
          }

          mergedItems = mergedItems.filter((item: any) => item.id !== 'REQ-2026-1001');

          setPaymentHistory(mergedItems);
          try {
            localStorage.setItem('billingmaster_payment_history', JSON.stringify(mergedItems));
          } catch (e) {}
          return;
        }
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem('billingmaster_payment_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((item: any) => item.id !== 'REQ-2026-1001');
          setPaymentHistory(cleaned);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    const checkHash = () => {
      if (
        window.location.hash === '#billing-history' ||
        window.location.hash === '#billing_history' ||
        window.location.hash === '#billing' ||
        window.location.search.includes('billing')
      ) {
        setActiveModal('billing-history');
        fetchLiveBillingHistory();
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    if (activeModal === 'billing-history') {
      fetchLiveBillingHistory();
      const interval = setInterval(fetchLiveBillingHistory, 4000);
      return () => clearInterval(interval);
    }
  }, [activeModal]);

  // Printer Test State
  const [printerWidth, setPrinterWidth] = useState<'58mm' | '80mm'>('80mm');
  const [printerConnection, setPrinterConnection] = useState<'bluetooth' | 'usb' | 'wifi'>('bluetooth');
  const [printerStatus, setPrinterStatus] = useState<'ready' | 'printing' | 'connected'>('ready');

  // Reminders & Notification Settings State
  const [notifyNewSales, setNotifyNewSales] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).notifyNewSales !== false;
    } catch {}
    return true;
  });
  const [notifyDailySales, setNotifyDailySales] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).notifyDailySales !== false;
    } catch {}
    return true;
  });
  const [notifyWeeklySales, setNotifyWeeklySales] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).notifyWeeklySales !== false;
    } catch {}
    return true;
  });
  const [notifyMonthlySales, setNotifyMonthlySales] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).notifyMonthlySales !== false;
    } catch {}
    return true;
  });
  const [notifyOther, setNotifyOther] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).notifyOther !== false;
    } catch {}
    return true;
  });
  const [autoWhatsappEnabled, setAutoWhatsappEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).whatsapp !== false;
    } catch {}
    return true;
  });
  const [autoSmsEnabled, setAutoSmsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).sms !== false;
    } catch {}
    return true;
  });
  const [autoInAppEnabled, setAutoInAppEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).inApp !== false;
    } catch {}
    return true;
  });
  const [autoEmailEnabled, setAutoEmailEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lms_reminder_prefs');
      if (saved) return JSON.parse(saved).email !== false;
    } catch {}
    return true;
  });

  useEffect(() => {
    let active = true;
    async function loadBiz() {
      try {
        const activeBid = await getBusinessId();
        const bizes = await db.list('businesses', activeBid ? { id: activeBid } : {});
        if (active && bizes.length > 0) {
          const matched = bizes.find((b: any) => activeBid && String(b.id) === String(activeBid)) || bizes[0];
          setBusiness(matched);
        }
      } catch (e) {}
    }
    loadBiz();
    return () => { active = false; };
  }, []);

  const businessName = business?.name || 'BillingMaster';
  const businessGstin = business?.gstin || '';
  const referralCode = `BM-${(business?.id || 'PRO').slice(0, 5).toUpperCase()}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSampleData = () => {
    setDeletedItems(SAMPLE_RECYCLE_BIN_ITEMS);
    try {
      localStorage.setItem('lms_recycle_bin_items', JSON.stringify(SAMPLE_RECYCLE_BIN_ITEMS));
    } catch {}
  };

  const handleRestoreItem = (id: string) => {
    const item = deletedItems.find(i => i.id === id);
    const updated = deletedItems.filter(i => i.id !== id);
    setDeletedItems(updated);
    try {
      localStorage.setItem('lms_recycle_bin_items', JSON.stringify(updated));
    } catch {}
    toast.success(`"${item?.title || 'Item'}" (${(item?.type || 'item').toUpperCase()}) successfully restored to active records.`);
  };

  const handlePermanentlyDeleteItem = (id: string) => {
    setPurgeTargetId(id);
  };

  const confirmPurgeItem = (id: string) => {
    const item = deletedItems.find(i => i.id === id);
    const updated = deletedItems.filter(i => i.id !== id);
    setDeletedItems(updated);
    try {
      localStorage.setItem('lms_recycle_bin_items', JSON.stringify(updated));
    } catch {}
    toast.success(`"${item?.title || 'Item'}" permanently removed.`);
    setPurgeTargetId(null);
  };

  const handleRestoreAllFiltered = () => {
    const idsToRestore = new Set(filteredDeletedItems.map(i => i.id));
    const updated = deletedItems.filter(i => !idsToRestore.has(i.id));
    setDeletedItems(updated);
    try {
      localStorage.setItem('lms_recycle_bin_items', JSON.stringify(updated));
    } catch {}
    toast.success(`${idsToRestore.size} deleted items restored successfully.`);
  };

  const handleEmptyFilteredBin = () => {
    setShowEmptyBinConfirm(true);
  };

  const confirmEmptyFilteredBin = () => {
    const idsToRemove = new Set(filteredDeletedItems.map(i => i.id));
    const updated = deletedItems.filter(i => !idsToRemove.has(i.id));
    setDeletedItems(updated);
    try {
      localStorage.setItem('lms_recycle_bin_items', JSON.stringify(updated));
    } catch {}
    toast.success(`Recycle bin emptied successfully.`);
    setShowEmptyBinConfirm(false);
  };

  const filteredDeletedItems = deletedItems.filter(item => {
    const matchesTab = recycleFilter === 'all' || item.type === recycleFilter;
    const q = recycleSearch.toLowerCase().trim();
    const matchesSearch = !q || 
      item.title.toLowerCase().includes(q) || 
      item.subtitle.toLowerCase().includes(q) || 
      (item.extraInfo && item.extraInfo.toLowerCase().includes(q));
    return matchesTab && matchesSearch;
  });

  const customerCount = deletedItems.filter(i => i.type === 'customer').length;
  const productCount = deletedItems.filter(i => i.type === 'product').length;
  const invoiceCount = deletedItems.filter(i => i.type === 'invoice').length;

  const handleTestPrint = () => {
    setPrinterStatus('printing');
    setTimeout(() => {
      setPrinterStatus('connected');
      toast.success(`Test receipt successfully dispatched to POS Thermal Printer (${printerWidth}, ${printerConnection.toUpperCase()}).`);
    }, 1200);
  };

  const navigateTo = (path: string) => {
    if (onNavigate) onNavigate(path);
    else setLocation(path);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Top Header Card */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">More & Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Application configuration, compliance, utilities and support</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-extrabold text-primary">
            v2.5.0 Production
          </span>
        </div>
      </div>

      {/* TOP SECTION: Help & Invite */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Help */}
        <div
          onClick={() => setActiveModal('help')}
          className="group flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
              <HelpCircle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Help & Support</h3>
              <p className="text-[11px] text-muted-foreground">User manual, guides & hotline</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Invite & Earn */}
        <div
          onClick={() => setActiveModal('invite-earn')}
          className="group flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-500/15 text-pink-600 dark:text-pink-400 group-hover:scale-105 transition-transform">
              <Gift size={22} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Invite & Earn</h3>
              <p className="text-[11px] text-muted-foreground">Get ₹500 credits per referral</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* SECTION 1: Settings Group */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">Settings</h2>
        <div className="rounded-2xl border border-border/80 bg-card divide-y divide-border/50 overflow-hidden shadow-xs">
          {/* Export for CA / Tax Audit */}
          <div
            onClick={() => setActiveModal('ca-tax-export')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer gap-2 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <FileSpreadsheet size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Export for CA / Tax Audit</h4>
                  <span className="rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-black px-1.5 py-0.2 uppercase tracking-wide">
                    New
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Generate 5-sheet audited Excel/CSV pack for GST, ITR, P&L, and Balance Sheets
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Invoice Templates & Print Setup */}
          <div
            onClick={() => setActiveModal('invoice-templates')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer gap-2"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <LayoutTemplate size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Invoice Templates & Print Setup</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select invoice layout & configure print page size (A4, A5, POS 80mm/58mm)
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>



          {/* Reminder Settings */}
          <div
            onClick={() => setActiveModal('reminders')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bell size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Notifications & Reminder Settings</h4>
                <p className="text-[11px] text-muted-foreground">New sales, daily/weekly/monthly reports & delivery channels</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Manage User */}
          <div
            onClick={() => setActiveModal('manage-users')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <UserCog size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Manage Staff & Roles</h4>
                <p className="text-[11px] text-muted-foreground">Staff logins, billing operator permissions</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Billing & Subscription History */}
          <div
            onClick={() => setActiveModal('billing-history')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <HistoryIcon size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Billing & Subscription History</h4>
                <p className="text-[11px] text-muted-foreground">View plan purchases, billing receipts & payment proof verifications</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Recycle Bin (Recovery Bin) */}
          <div
            onClick={() => {
              if (deletedItems.length === 0) {
                setDeletedItems(SAMPLE_RECYCLE_BIN_ITEMS);
                try {
                  localStorage.setItem('lms_recycle_bin_items', JSON.stringify(SAMPLE_RECYCLE_BIN_ITEMS));
                } catch {}
              }
              setRecycleFilter('all');
              setRecycleSearch('');
              setActiveModal('recycle-bin');
            }}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <RotateCcw size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Recycle Bin (Recovery Bin)</h4>
                <p className="text-[11px] text-muted-foreground">Recover deleted customers, products & invoices</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>

      {/* SECTION 2: Others Group */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">Others & Hardware</h2>
        <div className="rounded-2xl border border-border/80 bg-card divide-y divide-border/50 overflow-hidden shadow-xs">
          {/* Buy / Connect Printer */}
          <div
            onClick={() => setActiveModal('printer')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Printer size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">POS Thermal Printer Setup</h4>
                <p className="text-[11px] text-muted-foreground">Bluetooth & USB 58mm/80mm receipt printers</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* Rate App on Playstore */}
          <div
            onClick={() => setActiveModal('rate-app')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                <Star size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Rate App on Play Store</h4>
                <p className="text-[11px] text-muted-foreground">Share feedback & support updates</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* About */}
          <div
            onClick={() => setActiveModal('about')}
            className="group flex items-center justify-between p-4 hover:bg-muted/40 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Info size={20} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">About BillingMaster</h4>
                <p className="text-[11px] text-muted-foreground">Version 2.5.0, license & security specs</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>

      {/* Floating Bottom Help Trigger */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setActiveModal('help')}
          className="flex items-center gap-2 rounded-full bg-sidebar px-6 py-3 text-xs font-extrabold text-sidebar-foreground shadow-lg hover:scale-105 transition-all"
        >
          <HelpCircle size={16} className="text-secondary" />
          <span>Need Instant Support? Click Help</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODALS FOR EACH SETTING ITEM                                              */}
      {/* ========================================================================= */}

      {/* MODAL 1: Invite & Earn */}
      {activeModal === 'invite-earn' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/15 text-pink-600 dark:text-pink-400">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Invite & Earn Program</h3>
                  <p className="text-[11px] text-muted-foreground">Share BillingMaster with businesses</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-gradient-to-br from-pink-500/10 via-primary/10 to-transparent p-4 border border-pink-500/20 text-center">
                <p className="text-xs font-bold text-muted-foreground">Your Business Referral Code</p>
                <p className="text-2xl font-black font-mono text-primary mt-1 tracking-wider">{referralCode}</p>
                <button
                  onClick={() => copyToClipboard(referralCode)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Code Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="space-y-2 text-muted-foreground">
                <p><strong className="text-foreground">Step 1:</strong> Share your unique referral code with retail merchants.</p>
                <p><strong className="text-foreground">Step 2:</strong> They receive 30 days premium free upon sign-up.</p>
                <p><strong className="text-foreground">Step 3:</strong> You earn <strong className="text-emerald-600">₹500 billing credits</strong> directly to your account.</p>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-border flex items-center justify-between">
              <button onClick={() => setActiveModal(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
                Close
              </button>
              <button
                onClick={() => {
                  const msg = `Hey! Start managing your retail billing, GST invoices, and Khata Book on BillingMaster. Use my invite code *${referralCode}* to get free premium access.`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
              >
                <Share2 size={14} />
                <span>Invite via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Help & Support Center */}
      <HelpCenterModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} />

      {/* MODAL 3: POS Thermal Printer Setup */}
      {activeModal === 'printer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">POS Thermal Receipt Printer</h3>
                  <p className="text-[11px] text-muted-foreground">Configure 58mm / 80mm wireless & USB hardware</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1.5">Paper Width Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrinterWidth('58mm')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      printerWidth === '58mm' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <p className="font-extrabold text-foreground">58mm (2-inch Mini POS)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Portable Bluetooth printers</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrinterWidth('80mm')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      printerWidth === '80mm' ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <p className="font-extrabold text-foreground">80mm (3-inch Standard)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Countertop USB/LAN printers</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1.5">Connection Interface</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bluetooth', 'usb', 'wifi'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrinterConnection(c)}
                      className={`p-2.5 rounded-xl border text-center uppercase font-bold text-[11px] transition-all ${
                        printerConnection === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 text-[11px] text-muted-foreground">
                BillingMaster automatically sends formatted ESC/POS printer instructions with your logo, items, barcodes, and QR payment code.
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-border flex items-center justify-between">
              <button onClick={() => setActiveModal(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={handleTestPrint}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Printer size={14} />
                <span>{printerStatus === 'printing' ? 'Printing...' : 'Dispatch Test Print'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Reminder Settings */}
      {activeModal === 'reminders' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-5 sm:p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Notifications & Reminder Settings</h3>
                  <p className="text-[11px] text-muted-foreground">Configure event alerts, report summaries & delivery channels</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* TRIGGER EVENTS SECTION */}
              <div className="space-y-2">
                <p className="font-extrabold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">Receive Notifications For</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  
                  {/* New Sales */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <Receipt size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">New Sales</p>
                        <p className="text-[10px] text-muted-foreground">On every new invoice created</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyNewSales}
                      onChange={(e) => setNotifyNewSales(e.target.checked)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </label>

                  {/* Daily Sale Report */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">Daily Sale Report</p>
                        <p className="text-[10px] text-muted-foreground">End of day revenue & cash</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyDailySales}
                      onChange={(e) => setNotifyDailySales(e.target.checked)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </label>

                  {/* Weekly Sale Report */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0">
                        <CalendarDays size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">Weekly Sale Report</p>
                        <p className="text-[10px] text-muted-foreground">7-day performance analytics</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyWeeklySales}
                      onChange={(e) => setNotifyWeeklySales(e.target.checked)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </label>

                  {/* Monthly Sales Report */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                        <CalendarRange size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">Monthly Sales Report</p>
                        <p className="text-[10px] text-muted-foreground">Monthly GST & profit summary</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyMonthlySales}
                      onChange={(e) => setNotifyMonthlySales(e.target.checked)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </label>

                  {/* Other / System Alerts */}
                  <label className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                        <Layers size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">Other (Customer Dues & Low Stock Alerts)</p>
                        <p className="text-[10px] text-muted-foreground">Unpaid Khata balance alerts, minimum inventory thresholds & system notices</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifyOther}
                      onChange={(e) => setNotifyOther(e.target.checked)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* ACTIVE CHANNELS SECTION */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <p className="font-extrabold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground pt-1">Active Notification Channels</p>

                {/* WhatsApp */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <MessageSquare size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">WhatsApp Instant Reminders</p>
                      <p className="text-[10px] text-muted-foreground">1-click WhatsApp message with UPI payment QR</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoWhatsappEnabled}
                    onChange={(e) => setAutoWhatsappEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </label>

                {/* SMS */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">SMS Notifications</p>
                      <p className="text-[10px] text-muted-foreground">Send SMS payment link directly to customer phone</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSmsEnabled}
                    onChange={(e) => setAutoSmsEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </label>

                {/* In-App Notifications */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                      <Bell size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">In-App Notifications</p>
                      <p className="text-[10px] text-muted-foreground">Daily dashboard alerts & status badges for overdue credits</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoInAppEnabled}
                    onChange={(e) => setAutoInAppEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </label>

                {/* Email Notifications */}
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0">
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">Email Notifications</p>
                      <p className="text-[10px] text-muted-foreground">Automated PDF invoice dispatch & payment receipt email</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoEmailEnabled}
                    onChange={(e) => setAutoEmailEnabled(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-border flex items-center justify-between">
              <button onClick={() => setActiveModal(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('lms_reminder_prefs', JSON.stringify({
                      notifyNewSales,
                      notifyDailySales,
                      notifyWeeklySales,
                      notifyMonthlySales,
                      notifyOther,
                      whatsapp: autoWhatsappEnabled,
                      sms: autoSmsEnabled,
                      inApp: autoInAppEnabled,
                      email: autoEmailEnabled
                    }));
                  } catch {}
                  toast.success('Notification preferences saved successfully.');
                  setActiveModal(null);
                }}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Billing & Subscription History */}
      {activeModal === 'billing-history' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-2xl p-5 sm:p-6 animate-rise shadow-2xl border border-border max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary shrink-0">
                  <HistoryIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Billing & Subscription History</h3>
                  <p className="text-[11px] text-muted-foreground">View plan purchases, billing receipts & payment proof verifications</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Search Bar for Billing History */}
            <div className="pt-3 pb-2 shrink-0 border-b border-border/50">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search history by Billing ID (e.g. BILL-2026-9812), plan name, date, UTR..."
                  value={billingSearch}
                  onChange={(e) => setBillingSearch(e.target.value)}
                  className="input-shell w-full pl-9 pr-8 py-2 text-xs font-semibold"
                />
                {billingSearch && (
                  <button
                    onClick={() => setBillingSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 min-h-[220px]">
              {(() => {
                const filteredHistory = paymentHistory.filter((item) => {
                  const q = billingSearch.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (item.id && item.id.toLowerCase().includes(q)) ||
                    (item.planName && item.planName.toLowerCase().includes(q)) ||
                    (item.utr && item.utr.toLowerCase().includes(q)) ||
                    (item.timestamp && item.timestamp.toLowerCase().includes(q)) ||
                    (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q)) ||
                    (item.notes && item.notes.toLowerCase().includes(q))
                  );
                });

                if (filteredHistory.length === 0) {
                  return (
                    <div className="py-10 px-4 text-center text-xs text-muted-foreground">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 mx-auto mb-2.5 text-muted-foreground/50">
                        <HistoryIcon size={24} />
                      </div>
                      <p className="font-bold text-foreground text-sm">No billing records found</p>
                      <p className="mt-1 max-w-xs mx-auto text-[11px]">
                        {billingSearch
                          ? `No records matched "${billingSearch}". Try searching by Billing ID (e.g. BILL-2026-9812).`
                          : 'No plan purchase history recorded yet.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Billing Records ({filteredHistory.length})</span>
                      <span className="text-[10px] font-normal text-muted-foreground normal-case">Searchable by Billing ID</span>
                    </div>

                    {filteredHistory.map((item) => {
                      const isVerified = item.status === 'active_verified' || item.status === 'verified';
                      const isRejected = item.status === 'rejected';
                      return (
                        <div key={item.id} className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs hover:border-primary/30 transition-all">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                                {item.id}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-foreground">{item.planName || 'Business Upgrade'}</h4>
                            </div>
                            <span className={`rounded-full text-[10px] font-black px-2.5 py-0.5 border uppercase tracking-wider ${
                              isVerified
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isRejected
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                              {isVerified ? '● Active & Verified' : isRejected ? '● Rejected by Admin' : '● Pending Verification'}
                            </span>
                          </div>

                          {item.adminResponse && (
                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground font-medium flex items-start gap-2">
                              <MessageSquare size={14} className="text-primary shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-primary font-extrabold uppercase text-[10px] block tracking-wider">
                                  Admin Response Note:
                                </strong>
                                <span className="text-foreground">{item.adminResponse}</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-muted/30 p-2.5 rounded-xl border border-border/50">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Amount Paid</span>
                              <strong className="text-foreground font-black text-xs">{item.planPrice || item.amount || '₹499.00'}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Date & Time</span>
                              <strong className="text-foreground">{item.timestamp || `${item.date} ${item.time}`}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Payment Method</span>
                              <strong className="text-foreground">{item.paymentMethod || 'Direct UPI'}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">Billing ID</span>
                              <strong className="font-mono text-primary font-black">{item.id}</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                            <p className="text-[10px] text-muted-foreground font-medium">
                              Billing Reason: Purchased directly from BillingMaster platform
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedProofItem(item)}
                              className="btn-outline py-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10"
                            >
                              <ExternalLink size={13} />
                              <span>Open Payment Proof & Details</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Open Payment Proof & Details Viewer */}
      {selectedProofItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-5 sm:p-6 animate-rise shadow-2xl border border-border max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary shrink-0">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Payment Proof & Receipt Details</h3>
                  <p className="text-[11px] text-muted-foreground">Submitted payment verification record</p>
                </div>
              </div>
              <button onClick={() => setSelectedProofItem(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Billing Summary Box */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Billing ID:</span>
                  <span className="font-mono font-black text-primary">{selectedProofItem.id}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Purchased Plan / Reason:</span>
                  <span className="font-extrabold text-foreground">{selectedProofItem.planName}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-black text-foreground text-sm">{selectedProofItem.planPrice || selectedProofItem.amount || '₹499.00'}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Date & Time:</span>
                  <span className="font-semibold text-foreground">{selectedProofItem.timestamp || `${selectedProofItem.date} ${selectedProofItem.time}`}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="font-semibold text-foreground">{selectedProofItem.paymentMethod || 'Direct UPI App'}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">UTR / Transaction ID:</span>
                  <span className="font-mono font-extrabold text-foreground">{selectedProofItem.utr || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verification Status:</span>
                  <span className={`font-bold uppercase ${
                    selectedProofItem.status === 'active_verified' || selectedProofItem.status === 'verified'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {selectedProofItem.status === 'active_verified' || selectedProofItem.status === 'verified' ? 'Active & Verified' : 'Pending Review'}
                  </span>
                </div>
              </div>

              {/* Submitted Screenshot Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-foreground block">Uploaded Payment Receipt Screenshot</label>
                {selectedProofItem.screenshotUrl ? (
                  <div className="rounded-2xl border border-border bg-black/5 p-2 text-center">
                    <img
                      src={selectedProofItem.screenshotUrl}
                      alt="Payment Proof Receipt"
                      className="max-h-60 mx-auto rounded-xl object-contain shadow-xs border border-border"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center bg-muted/10 space-y-2">
                    <Receipt size={32} className="mx-auto text-muted-foreground/50" />
                    <p className="text-xs font-bold text-muted-foreground">No Screenshot File Uploaded</p>
                    <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">This entry was recorded directly via admin verification or UPI reference string.</p>
                  </div>
                )}
              </div>

              {/* Submitted Text / Optional Notes */}
              {selectedProofItem.notes && (
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-foreground block">Submitted Payment Notes & Message</label>
                  <div className="rounded-xl border border-border bg-card p-3 text-xs text-foreground font-medium leading-relaxed">
                    {selectedProofItem.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Recycle Bin (Recovery Bin) */}
      {activeModal === 'recycle-bin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-2xl p-5 sm:p-6 animate-rise shadow-2xl border border-border max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/15 text-destructive shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Recycle Bin & Data Recovery</h3>
                  <p className="text-[11px] text-muted-foreground">Restore deleted customers, products & invoices</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="pt-3 pb-2 space-y-2.5 shrink-0 border-b border-border/50">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search deleted records by name, invoice #, phone, barcode..."
                  value={recycleSearch}
                  onChange={(e) => setRecycleSearch(e.target.value)}
                  className="input-shell w-full pl-9 pr-8 py-2 text-xs font-semibold"
                />
                {recycleSearch && (
                  <button
                    onClick={() => setRecycleSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setRecycleFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    recycleFilter === 'all'
                      ? 'bg-foreground text-background shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>All</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${recycleFilter === 'all' ? 'bg-background/20 text-background' : 'bg-muted-foreground/15 text-foreground'}`}>
                    {deletedItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecycleFilter('customer')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    recycleFilter === 'customer'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Users size={13} />
                  <span>Customers</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${recycleFilter === 'customer' ? 'bg-white/20 text-white' : 'bg-muted-foreground/15 text-foreground'}`}>
                    {customerCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecycleFilter('product')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    recycleFilter === 'product'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Package size={13} />
                  <span>Products</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${recycleFilter === 'product' ? 'bg-white/20 text-white' : 'bg-muted-foreground/15 text-foreground'}`}>
                    {productCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecycleFilter('invoice')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    recycleFilter === 'invoice'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Receipt size={13} />
                  <span>Invoices</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${recycleFilter === 'invoice' ? 'bg-white/20 text-white' : 'bg-muted-foreground/15 text-foreground'}`}>
                    {invoiceCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-bar showing count */}
            {filteredDeletedItems.length > 0 && (
              <div className="py-2 px-1 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                <span>Showing <strong>{filteredDeletedItems.length}</strong> deleted {filteredDeletedItems.length === 1 ? 'record' : 'records'}</span>
              </div>
            )}

            {/* List Body */}
            <div className="mt-2 flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px]">
              {filteredDeletedItems.length === 0 ? (
                <div className="py-10 px-4 text-center text-xs text-muted-foreground">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 mx-auto mb-2.5 text-muted-foreground/50">
                    <RotateCcw size={24} />
                  </div>
                  <p className="font-bold text-foreground text-sm">No deleted records found</p>
                  <p className="mt-1 max-w-xs mx-auto text-[11px]">
                    {recycleSearch
                      ? `No items matched "${recycleSearch}". Try clearing your search keyword.`
                      : `The ${recycleFilter !== 'all' ? recycleFilter : ''} recycle bin is currently clear.`}
                  </p>
                </div>
              ) : (
                filteredDeletedItems.map((item) => {
                  const isCustomer = item.type === 'customer';
                  const isProduct = item.type === 'product';
                  const isInvoice = item.type === 'invoice';

                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Type Icon Badge */}
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-xl shrink-0 mt-0.5 ${
                            isCustomer
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              : isProduct
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isCustomer && <Users size={18} />}
                          {isProduct && <Package size={18} />}
                          {isInvoice && <Receipt size={18} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                              {item.title}
                            </h4>
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isCustomer
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : isProduct
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {item.type}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                            {item.subtitle}
                          </p>

                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                            {item.extraInfo && (
                              <span className="font-semibold text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                                {item.extraInfo}
                              </span>
                            )}
                            <span>Deleted: {item.deleted_at}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleRestoreItem(item.id)}
                          className="btn-primary py-1.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                          title="Restore back to active records"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between shrink-0">
              <span className="text-[11px] text-muted-foreground">
                Items can be restored with one click anytime.
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-5 py-2 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Manage Users */}
      {activeModal === 'manage-users' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <UserCog size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Manage Staff Logins & Roles</h3>
                  <p className="text-[11px] text-muted-foreground">Control operator access permissions</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
                <div>
                  <p className="font-black text-foreground">Owner Account (Primary)</p>
                  <p className="text-[10px] text-muted-foreground">Full unrestricted admin & settings control</p>
                </div>
                <span className="rounded-full bg-primary/10 text-primary font-black text-[10px] px-2.5 py-0.5 uppercase">
                  Owner
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Counter Operator / Cashier</p>
                  <p className="text-[10px] text-muted-foreground">Can create invoices & collect cash, no report access</p>
                </div>
                <span className="rounded-full bg-muted text-foreground font-bold text-[10px] px-2.5 py-0.5 uppercase">
                  Operator
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">Accountant / CA</p>
                  <p className="text-[10px] text-muted-foreground">Read-only access to GSTR reports and ledgers</p>
                </div>
                <span className="rounded-full bg-muted text-foreground font-bold text-[10px] px-2.5 py-0.5 uppercase">
                  Accountant
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Rate App */}
      {activeModal === 'rate-app' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                  <Star size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Rate BillingMaster</h3>
                  <p className="text-[11px] text-muted-foreground">We appreciate your review & feedback</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            {ratingSubmitted ? (
              <div className="mt-6 py-6 text-center space-y-2">
                <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-sm font-extrabold text-foreground">Thank You for Your 5-Star Rating!</h4>
                <p className="text-xs text-muted-foreground">Your support keeps us improving BillingMaster.</p>
                <button
                  onClick={() => {
                    setRatingSubmitted(false);
                    setActiveModal(null);
                  }}
                  className="btn-primary rounded-xl px-5 py-2 text-xs font-bold mt-4"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-center">
                <p className="text-xs text-muted-foreground">How is your billing and accounting experience?</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingVal(star)}
                      className="p-1 text-yellow-500 hover:scale-125 transition-transform"
                    >
                      <Star size={28} fill={star <= ratingVal ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  placeholder="Tell us what you love or how we can improve..."
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  className="input-shell w-full text-xs"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setActiveModal(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">
                    Cancel
                  </button>
                  <button
                    onClick={() => setRatingSubmitted(true)}
                    className="btn-primary rounded-xl px-5 py-2 text-xs font-bold"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 8: About */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">About Application</h3>
                  <p className="text-[11px] text-muted-foreground">System specifications & build</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Application Name:</span>
                <strong className="text-foreground">BillingMaster</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Version:</span>
                <strong className="text-foreground">2.5.0 (Enterprise)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>GST Compliance:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">CBIC & HSN 2026 Ready</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span>Database Engine:</span>
                <strong className="text-foreground">Real-time Encrypted Cloud DB</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>License:</span>
                <strong className="text-foreground">Commercial Business License</strong>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: GST Rate Finder (Shared) */}
      {activeModal === 'gst-finder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Search size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">GST Rate & HSN Directory</h3>
                  <p className="text-[11px] text-muted-foreground">Standard Indian GST Tax Slabs & Codes</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { hsn: '0000', item: 'Fresh Fruits, Milk, Salt, Curd', rate: '0% (Nil Rated)', type: 'Exempt Goods' },
                { hsn: '1006', item: 'Packaged Food Items, Edible Oil, Tea, Coffee', rate: '5% (2.5% CGST + 2.5% SGST)', type: 'Essential Goods' },
                { hsn: '6101', item: 'Apparel & Readymade Clothing (> ₹1,000)', rate: '12% (6% CGST + 6% SGST)', type: 'Standard Rate 1' },
                { hsn: '8517', item: 'Smartphones, Electronic Hardware, IT Services', rate: '18% (9% CGST + 9% SGST)', type: 'Standard Rate 2' },
                { hsn: '8703', item: 'Automobiles, Air Conditioners, Luxury Goods', rate: '28% (14% CGST + 14% SGST)', type: 'Luxury Rate' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">HSN {item.hsn}</span>
                      <span className="text-xs font-extrabold text-foreground">{item.item}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.type}</p>
                  </div>
                  <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                    {item.rate}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold">
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: Invoice Template & Print Setup */}
      <InvoiceTemplateModal
        isOpen={activeModal === 'invoice-templates'}
        onClose={() => setActiveModal(null)}
        onSaved={(st) => setTemplateSettings(st)}
      />

      {/* MODAL 11: CA & Tax Audit Export */}
      <CATaxExportModal
        isOpen={activeModal === 'ca-tax-export'}
        onClose={() => setActiveModal(null)}
      />

      {/* Confirmation Modal: Purge Single Item */}
      {purgeTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl relative overflow-hidden animate-rise">
            <div className="text-center">
              <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-extrabold text-foreground">Permanently Delete Item</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to purge <span className="font-bold text-foreground">"{deletedItems.find(i => i.id === purgeTargetId)?.title || 'this item'}"</span>? This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setPurgeTargetId(null)}
                className="flex-1 rounded-xl border border-border bg-muted/30 py-2.5 px-4 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmPurgeItem(purgeTargetId)}
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground py-2.5 px-4 text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                Purge Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Recycle Bin */}
      {showEmptyBinConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl relative overflow-hidden animate-rise">
            <div className="text-center">
              <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
                <Trash2 size={24} />
              </div>
              <h3 className="text-base font-extrabold text-foreground">Empty Recycle Bin</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to permanently remove all <span className="font-bold text-foreground">{filteredDeletedItems.length}</span> items from the recycle bin?
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowEmptyBinConfirm(false)}
                className="flex-1 rounded-xl border border-border bg-muted/30 py-2.5 px-4 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEmptyFilteredBin}
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground py-2.5 px-4 text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
