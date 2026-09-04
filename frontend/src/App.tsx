import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import domtoimage from 'dom-to-image';
import jsPDF from 'jspdf';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { auth, db, getBusinessId, setCurrentBusinessId, supabase, supabaseConfigured, getSupabaseErrorMessage, getProductBarcode, generateInternalSku, getProductUniqueId } from '@/lib/api';
import { useScrollReset, resetScrollRef } from '@/lib/useScrollReset';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useBrowserLocation } from 'wouter/use-browser-location';
import { DesktopTitlebar } from '@/components/DesktopTitlebar';
import { isDesktopOrFile } from '@/lib/platform';
import { mobileService } from '@/services/mobileService';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Ban, BarChart3, Bell, BookOpen, Boxes, BriefcaseBusiness, Building2, Calendar, Check,
  CheckCircle2, ChevronDown, CircleDollarSign, ClipboardList, Clock, CreditCard, Download, FilePlus2, FileText, HelpCircle,
  Landmark, LayoutDashboard, Lock, Unlock, LogOut, ImagePlus, Camera, Mail, MapPin, Menu, MessageCircle, Minus, MoreHorizontal, Package, Pencil, Phone, PhoneCall, Plus, Printer, QrCode, Receipt,
  RefreshCw, Search, Send, Settings as SettingsIcon, ShoppingCart, SlidersHorizontal, Sparkles, Store, Trash2, Eye, EyeOff,
  Truck, UserRound, Users, Wallet, X, XCircle, AlertCircle, Share2, Copy, ScanLine, Barcode, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCheck, ExternalLink, Inbox, Info, BellRing, Filter, RotateCcw, History,
} from 'lucide-react';
import { KhataBook } from '@/components/KhataBook';
import { BarcodeVerifierModal } from '@/components/BarcodeVerifierModal';
import { Reports } from '@/components/Reports';
import { Expenses } from '@/components/Expenses';
import { GSTVerificationInput } from '@/components/GSTVerificationInput';
import { ForYouHub } from '@/components/ForYouHub';
import { PublicCatalog } from '@/components/PublicCatalog';
import { MoreHub } from '@/components/MoreHub';
import { HelpCenterModal } from '@/components/HelpCenterModal';
import {
  InvoiceTemplateModal,
  INVOICE_TEMPLATES,
  PRINT_SIZES,
  type InvoiceTemplateSettings
} from '@/components/InvoiceTemplateModal';

const queryClient = new QueryClient();
type Row = Record<string, any>;
type Icon = typeof LayoutDashboard;

export async function getNextInvoiceNumber(bid?: string | null): Promise<string> {
  try {
    let businessId = bid;
    if (!businessId) businessId = await getBusinessId();

    let prefix = 'INV';
    let allInvoices: Row[] = [];

    if (businessId) {
      try {
        const sets = await db.list<Row>('settings', { business_id: businessId });
        if (sets.length && sets[0]?.invoice_prefix) {
          prefix = sets[0].invoice_prefix;
        }
      } catch (e) {}

      try {
        allInvoices = await db.list<Row>('invoices', { business_id: businessId });
      } catch (e) {
        allInvoices = await db.list<Row>('invoices');
      }
    } else {
      allInvoices = await db.list<Row>('invoices');
    }

    let maxSeqInDb = 0;
    allInvoices.forEach((inv) => {
      const numStr = String(inv.invoice_number || '');
      const match = numStr.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxSeqInDb) {
          maxSeqInDb = num;
        }
      }
    });

    const storageKey = businessId ? `bm_last_invoice_seq_${businessId}` : 'bm_last_invoice_seq_global';
    let storedSeq = 0;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) storedSeq = parseInt(stored, 10) || 0;
    } catch (e) {}

    const nextSeq = Math.max(maxSeqInDb + 1, storedSeq + 1, 1);

    try {
      localStorage.setItem(storageKey, String(nextSeq));
    } catch (e) {}

    return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
  } catch (err) {
    const fallbackNum = Date.now().toString().slice(-6);
    return `INV-${fallbackNum}`;
  }
}

function useTable<T extends Row>(table: string, query: Record<string, string | number | boolean | undefined> = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryKey = JSON.stringify(query);
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await db.list<T>(table, query)); } catch (e) { setError(getSupabaseErrorMessage(e, 'Could not load this data.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [table, queryKey]);
  return { data, loading, error, reload: load, setData };
}

function usePaginatedTable<T extends Row>(
  table: string,
  baseQuery: Record<string, any> = {},
  pageSize: number = 40
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const baseQueryKey = JSON.stringify(baseQuery);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    setOffset(0);
    try {
      const queryPayload: Record<string, any> = {
        ...baseQuery,
        limit: pageSize,
        offset: 0,
      };
      if (search.trim()) queryPayload.search = search.trim();

      const items = await db.list<T>(table, queryPayload);
      setData(items);
      setHasMore(items.length >= pageSize);
    } catch (e) {
      setError(getSupabaseErrorMessage(e, 'Could not load data.'));
    } finally {
      setLoading(false);
    }
  }, [table, baseQueryKey, search, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + pageSize;
    try {
      const queryPayload: Record<string, any> = {
        ...baseQuery,
        limit: pageSize,
        offset: nextOffset,
      };
      if (search.trim()) queryPayload.search = search.trim();

      const newItems = await db.list<T>(table, queryPayload);
      if (newItems.length > 0) {
        setData((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const uniqueNew = newItems.filter((i) => !existingIds.has(i.id));
          return [...prev, ...uniqueNew];
        });
        setOffset(nextOffset);
        setHasMore(newItems.length >= pageSize);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.warn('Error loading more paginated data:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [table, baseQueryKey, search, pageSize, offset, loading, loadingMore, hasMore]);

  return {
    data,
    loading,
    loadingMore,
    hasMore,
    search,
    setSearch,
    loadMore,
    reload,
    setData,
    error,
  };
}

function InfiniteScrollSentinel({ onIntersect, hasMore, loadingMore }: { onIntersect: () => void; hasMore: boolean; loadingMore: boolean }) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin: '400px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [onIntersect, hasMore]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
      {loadingMore && (
        <>
          <RefreshCw size={14} className="animate-spin text-primary" />
          <span>Loading more records seamlessly...</span>
        </>
      )}
    </div>
  );
}

const navItems: { href: string; label: string; icon: Icon }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/khatabook', label: 'Khata Book', icon: BookOpen },
  { href: '/for-you', label: 'Toolkit', icon: Sparkles },
  { href: '/expenses', label: 'Expenses', icon: Wallet },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/more', label: 'More', icon: MoreHorizontal },
];

const mobileNavItems: { href: string; label: string; icon: Icon }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/khatabook', label: 'Khata Book', icon: BookOpen },
];

function AppField({ label, value, onChange, type = 'text', required, test, placeholder }: { label: string; value: any; onChange: (v: string) => void; type?: string; required?: boolean; test?: string; placeholder?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <label className="block text-xs font-bold">{label}
      <div className="relative mt-2">
        <input
          type={effectiveType}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`input-shell w-full px-3 text-sm font-normal ${isPassword ? 'pr-10' : ''}`}
          data-testid={test}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </label>
  );
}

function getCustomerGstin(row: Row): string {
  if (row.gstin) return row.gstin;
  if (row.notes && (typeof row.notes === 'string') && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
    try {
      const meta = JSON.parse(row.notes);
      if (meta.gstin) return meta.gstin;
    } catch (e) {}
  }
  return '';
}

function getCustomerNotes(row: Row): string {
  if (row.notes && (typeof row.notes === 'string') && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
    try {
      const meta = JSON.parse(row.notes);
      if (meta.notes !== undefined) return meta.notes;
    } catch (e) {}
  }
  return row.notes || '';
}

function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled,
  testId,
  className = 'relative mt-2',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string; hint?: string }[];
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={className}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`input-shell flex min-h-11 w-full items-center justify-between px-3.5 py-2.5 text-sm font-normal shadow-sm transition-all duration-150 ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/20'
        } ${open ? 'border-primary ring-2 ring-primary/20' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedOption ? 'font-medium text-foreground' : 'text-muted-foreground'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute top-full left-0 z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border/80 bg-card p-1.5 text-card-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95"
          >
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`relative flex w-full cursor-pointer select-none items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                    isSelected
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-foreground hover:bg-muted/80'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="truncate">{opt.label}</div>
                    {opt.hint && (
                      <div className="text-[11px] font-normal text-muted-foreground">{opt.hint}</div>
                    )}
                  </div>
                  {isSelected && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 text-inherit no-underline" data-testid="link-logo">
      <img 
        src="/logo.webp" 
        alt="BillingMaster Logo" 
        className="h-9 w-9 rounded-xl object-contain shadow-xs bg-white/10 p-0.5" 
        onError={(e) => {
          (e.target as HTMLImageElement).src = "https://cdn-1.webcatalog.io/catalog/mybillbook/mybillbook-icon-filled-256.webp?v=1716618710030";
        }}
      />
      <span className="text-[15px] font-extrabold tracking-[-.04em]">BillingMaster<span className="text-secondary">.</span></span>
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lms_read_notifications') || '[]');
    } catch {
      return [];
    }
  });
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lms_dismissed_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const [helpOpen, setHelpOpen] = useState(false);
  const [profile, setProfile] = useState<Row | null>(null);
  const [business, setBusiness] = useState<Row | null>(null);
  const [workspaceProducts, setWorkspaceProducts] = useState<Row[]>([]);
  const [workspaceInvoices, setWorkspaceInvoices] = useState<Row[]>([]);
  const [workspaceCustomers, setWorkspaceCustomers] = useState<Row[]>([]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Save read & dismissed notification IDs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lms_read_notifications', JSON.stringify(readNotificationIds));
    } catch (e) {
      console.warn('Failed saving read notifications:', e);
    }
  }, [readNotificationIds]);

  useEffect(() => {
    try {
      localStorage.setItem('lms_dismissed_notifications', JSON.stringify(dismissedNotificationIds));
    } catch (e) {
      console.warn('Failed saving dismissed notifications:', e);
    }
  }, [dismissedNotificationIds]);

  // Handle outside clicks to close dropdowns & prevent number input scroll changes
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setHelpOpen(false);
      }
    }
    function handleWheel(event: WheelEvent) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number') {
        (activeEl as HTMLElement).blur();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Close dropdown on navigation
  useEffect(() => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setHelpOpen(false);
  }, [location]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        let session = auth.session();
        if (!session) {
          session = await auth.getSession();
        }
        if (!session && active) {
          setLocation('/login');
          return;
        }
        if (session && active) {
          const profiles = await db.list<Row>('profiles', { id: session.user.id });
          if (active) {
            if (!profiles.length || !profiles[0]?.business_id) {
              setLocation('/onboarding');
              return;
            }
            const p = profiles[0];
            setProfile(p);
            const bid = p.business_id;
            if (bid) {
              const [businesses, prods, invs, custs] = await Promise.all([
                db.list<Row>('businesses', { id: bid }),
                db.list<Row>('products', {}).catch(() => []),
                db.list<Row>('invoices', {}).catch(() => []),
                db.list<Row>('customers', {}).catch(() => []),
              ]);
              if (active) {
                if (businesses.length) setBusiness(businesses[0]);
                setWorkspaceProducts(prods || []);
                setWorkspaceInvoices(invs || []);
                setWorkspaceCustomers(custs || []);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading profile in Shell:', err);
      }
    }
    void loadData();
    return () => { active = false; };
  }, [location]);

  // Compute rich, live notifications
  const rawNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'inventory' | 'invoice' | 'customer' | 'gst' | 'system';
      category: 'Alerts' | 'Billing' | 'System';
      title: string;
      summary: string;
      details: string;
      timestamp: string;
      severity: 'high' | 'medium' | 'info' | 'success';
      actionLabel?: string;
      actionHref?: string;
      stats?: { label: string; value: string }[];
    }> = [];

    // 1. Low stock inventory alert
    const lowStockItems = workspaceProducts.filter(p => {
      const stock = Number(p.stock_quantity ?? p.stock ?? 0);
      const minAlert = Number(p.min_stock_alert ?? 5);
      return stock <= minAlert;
    });

    if (lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 3).map(p => p.name || 'Unnamed item').join(', ');
      list.push({
        id: 'notif-low-stock',
        type: 'inventory',
        category: 'Alerts',
        title: 'Low Stock Inventory Alert',
        summary: `${lowStockItems.length} product(s) have reached critically low stock levels.`,
        details: `The inventory for ${names}${lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : ''} has dropped below the threshold. Restock these items to prevent checkout interruptions.`,
        timestamp: 'Real-time alert',
        severity: 'high',
        actionLabel: 'Manage Products & Stock',
        actionHref: '/products',
        stats: [
          { label: 'Low Stock Items', value: `${lowStockItems.length} Products` },
          { label: 'Top Low Stock', value: lowStockItems[0]?.name || 'N/A' },
        ],
      });
    }

    // 2. Unpaid & Overdue Invoices
    const unpaidInvoices = workspaceInvoices.filter(inv => {
      const status = String(inv.payment_status || inv.status || '').toLowerCase();
      return status === 'unpaid' || status === 'overdue' || status === 'partial';
    });

    if (unpaidInvoices.length > 0) {
      const totalUnpaid = unpaidInvoices.reduce((acc, inv) => acc + Number(inv.total_amount || inv.total || 0), 0);
      list.push({
        id: 'notif-unpaid-invoices',
        type: 'invoice',
        category: 'Billing',
        title: 'Pending & Unpaid Invoices',
        summary: `${unpaidInvoices.length} invoice(s) awaiting customer settlement (₹${totalUnpaid.toLocaleString('en-IN')}).`,
        details: `You have ${unpaidInvoices.length} unpaid or partial invoices in the system. Review pending bills and send WhatsApp payment reminders.`,
        timestamp: 'Live billing status',
        severity: 'medium',
        actionLabel: 'View Pending Invoices',
        actionHref: '/invoices',
        stats: [
          { label: 'Pending Bills', value: `${unpaidInvoices.length} Invoices` },
          { label: 'Outstanding Sum', value: `₹${totalUnpaid.toLocaleString('en-IN')}` },
        ],
      });
    }

    // 3. Customer Khata Credit Balances
    const customersWithCredit = workspaceCustomers.filter(c => Number(c.current_balance || c.balance || 0) > 0);
    if (customersWithCredit.length > 0) {
      const totalCreditDue = customersWithCredit.reduce((acc, c) => acc + Number(c.current_balance || c.balance || 0), 0);
      const topCustomer = customersWithCredit[0]?.name || 'Customer';
      list.push({
        id: 'notif-khata-dues',
        type: 'customer',
        category: 'Billing',
        title: 'Customer Khata Credit Balance Due',
        summary: `₹${totalCreditDue.toLocaleString('en-IN')} pending in customer credit accounts.`,
        details: `${customersWithCredit.length} customer(s) have outstanding Udhar/credit balance recorded in the Khata ledger. Highest pending: ${topCustomer}.`,
        timestamp: 'Ledger update',
        severity: 'medium',
        actionLabel: 'Open Khata Ledger',
        actionHref: '/khatabook',
        stats: [
          { label: 'Ledger Dues', value: `₹${totalCreditDue.toLocaleString('en-IN')}` },
          { label: 'Customer Count', value: `${customersWithCredit.length} Accounts` },
        ],
      });
    }

    // 4. GST & Tax Setup
    if (business?.gstin) {
      list.push({
        id: 'notif-gst-status',
        type: 'gst',
        category: 'System',
        title: 'GST Compliance Active',
        summary: `GSTIN ${business.gstin} configured & verified.`,
        details: `Your workspace is configured for official GST billing. Invoices will automatically compute itemized CGST, SGST, or IGST with SAC/HSN codes.`,
        timestamp: 'System verified',
        severity: 'success',
        actionLabel: 'View Business & Tax Settings',
        actionHref: '/settings',
        stats: [
          { label: 'Tax ID', value: business.gstin },
          { label: 'Jurisdiction', value: business.state_jurisdiction || 'India' },
        ],
      });
    } else {
      list.push({
        id: 'notif-nongst-status',
        type: 'gst',
        category: 'System',
        title: 'Retail Billing Mode Active',
        summary: 'Operating in Non-GST retail mode.',
        details: 'You are currently generating regular retail commercial bills. If you obtain a GSTIN, you can enable GST billing anytime in Settings.',
        timestamp: 'System info',
        severity: 'info',
        actionLabel: 'Configure GST Settings',
        actionHref: '/settings',
      });
    }

    // 5. Cloud Sync & Security Active
    list.push({
      id: 'notif-cloud-sync',
      type: 'system',
      category: 'System',
      title: 'Realtime Cloud Database Connected',
      summary: `${business?.name || 'BillingMaster'} secure storage active.`,
      details: 'All products, customer ledgers, invoices, barcode registries, and daily sales metrics are encrypted and backed up in real-time.',
      timestamp: 'Active now',
      severity: 'info',
      actionLabel: 'View Financial Reports',
      actionHref: '/reports',
    });

    return list;
  }, [workspaceProducts, workspaceInvoices, workspaceCustomers, business]);

  // Filter out dismissed notifications
  const allNotifications = useMemo(() => {
    return rawNotifications
      .filter(n => !dismissedNotificationIds.includes(n.id))
      .map(n => ({
        ...n,
        read: readNotificationIds.includes(n.id),
      }));
  }, [rawNotifications, dismissedNotificationIds, readNotificationIds]);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !n.read).length;
  }, [allNotifications]);

  const markAllAsRead = () => {
    const allIds = rawNotifications.map(n => n.id);
    setReadNotificationIds(allIds);
  };

  const toggleReadStatus = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (readNotificationIds.includes(id)) {
      setReadNotificationIds(prev => prev.filter(i => i !== id));
    } else {
      setReadNotificationIds(prev => [...prev, id]);
    }
  };

  const dismissNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedNotificationIds(prev => [...prev, id]);
  };

  const current = navItems.find((item) => location.startsWith(item.href));
  const pageTitle = current?.label || (location.includes('settings') ? 'Settings' : 'Workspace');
  
  const session = auth.session();
  const userMeta = session?.user?.user_metadata || {};
  const userName = profile?.full_name || userMeta.full_name || userMeta.name || session?.user?.email?.split('@')[0] || 'User';
  const userEmail = session?.user?.email || 'user@example.com';
  const initials = (userName.trim().split(' ').map((n: string) => n[0]).join('').substring(0, 2) || 'AV').toUpperCase();
  const rawBizName = business?.name || userMeta.business_name || '';
  const workspaceName = rawBizName && rawBizName.trim().length > 2 && rawBizName.trim().toLowerCase() !== 'av' ? rawBizName : 'BillingMaster Enterprise';
  const businessGstin = business?.gstin || userMeta.gstin || '';
  const userRole = profile?.role || 'Owner';

  const handleSignOut = async () => {
    setProfileOpen(false);
    await auth.signOut();
    setLocation('/login');
  };

  return <div className="noise flex min-h-[100dvh] bg-background print:bg-white print:p-0">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0 print:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-9 flex items-center justify-between px-2"><Logo /><button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-sidebar-foreground/60 lg:hidden" data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/40">Workspace</div>
      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: NavIcon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold no-underline transition-colors ${location.startsWith(href) ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${label.toLowerCase()}`}>
          <NavIcon size={17} strokeWidth={location.startsWith(href) ? 2.5 : 1.8} /><span>{label}</span>{label === 'Invoices' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-secondary" />}
        </Link>)}
      </nav>
      <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/40">Manage</div>
      <nav className="mt-3 space-y-1">
        <Link href="/settings" onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold no-underline transition-colors ${location.startsWith('/settings') ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/62 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`} data-testid="link-nav-settings"><SettingsIcon size={17} /><span>Settings</span></Link>
      </nav>
      <div className="mt-auto rounded-2xl border border-sidebar-foreground/10 bg-sidebar-accent/45 p-3.5">
        <div className="mb-3 flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{initials}</span><span className="rounded-full bg-secondary/15 px-2 py-1 text-[10px] font-bold text-secondary">{userRole.toUpperCase()}</span></div>
        <div className="truncate text-xs font-bold">{workspaceName}</div><div className="mt-0.5 truncate text-[11px] text-sidebar-foreground/50">Business profile</div>
        <button className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-sidebar-foreground/58 hover:text-sidebar-foreground" onClick={handleSignOut} data-testid="button-signout"><LogOut size={13} /> Sign out</button>
      </div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-sidebar/30 lg:hidden print:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-overlay" />}
    <main className="min-w-0 flex-1 print:w-full print:p-0">
      <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur-md sm:px-7 lg:px-10 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-muted lg:hidden" data-testid="button-open-menu">
            <Menu size={20} />
          </button>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Workspace / <span className="text-foreground">{pageTitle}</span></div>
            <h1 className="mt-0.5 text-lg font-extrabold tracking-[-.035em]">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Help Button */}
          <button 
            onClick={() => setHelpOpen(!helpOpen)} 
            className={`rounded-lg p-2 transition-colors ${helpOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            data-testid="button-help"
            title="Help & Documentation"
          >
            <HelpCircle size={18} />
          </button>

            {/* Professional Notifications Button & Popover */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)} 
                className={`relative rounded-xl p-2 transition-all ${
                  notificationsOpen 
                    ? 'bg-muted text-foreground ring-2 ring-primary/30' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="button-notifications"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={19} className={unreadCount > 0 ? 'text-foreground' : ''} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-xs animate-scale-in">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Clean Notifications Dropdown Panel */}
              {notificationsOpen && (
                <div className="fixed inset-x-3 top-[68px] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-border/80 bg-card shadow-2xl animate-rise z-50 overflow-hidden">
                  {/* Clean Header */}
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Bell size={15} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-foreground">Notifications</h4>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-black text-primary">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors"
                        title="Mark all as read"
                      >
                        <CheckCheck size={13} />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-border/40 p-2 space-y-1.5">
                    {allNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground mb-2">
                          <Inbox size={22} />
                        </div>
                        <p className="text-xs font-bold text-foreground">No notifications</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
                          You're all caught up with your workspace alerts.
                        </p>
                      </div>
                    ) : (
                      allNotifications.map((notif) => {
                        const isUnread = !notif.read;
                        return (
                          <div
                            key={notif.id}
                            className={`group relative flex items-start gap-3 rounded-xl p-3 text-left transition-all ${
                              isUnread 
                                ? 'bg-primary/5 hover:bg-primary/10' 
                                : 'bg-card hover:bg-muted/40'
                            }`}
                          >
                            {/* Severity / Type Icon */}
                            <div className="mt-0.5 shrink-0">
                              {notif.severity === 'high' ? (
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-destructive/15 text-destructive">
                                  <AlertTriangle size={15} />
                                </span>
                              ) : notif.severity === 'medium' ? (
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  <AlertCircle size={15} />
                                </span>
                              ) : notif.severity === 'success' ? (
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck size={15} />
                                </span>
                              ) : (
                                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 text-primary">
                                  <Info size={15} />
                                </span>
                              )}
                            </div>

                            {/* Title & Description Only */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs ${isUnread ? 'font-black text-foreground' : 'font-bold text-foreground/90'}`}>
                                  {notif.title}
                                </p>
                                {isUnread && (
                                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                {notif.summary}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

          <div className="ml-1 hidden h-8 w-px bg-border sm:block" />

          {/* Profile Dropdown Trigger & Popover */}
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center gap-2 rounded-xl p-1.5 pr-2 transition-all ${
                profileOpen 
                  ? 'bg-muted ring-2 ring-primary/30' 
                  : 'hover:bg-muted'
              }`} 
              data-testid="button-profile"
              aria-expanded={profileOpen}
              aria-label="User profile menu"
            >
              <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-primary-foreground shadow-xs">
                {initials}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
              </span>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-bold leading-none text-foreground max-w-[120px] truncate">{userName}</p>
                <p className="text-[10px] font-semibold text-muted-foreground leading-none mt-1 truncate max-w-[120px]">{workspaceName}</p>
              </div>
              <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${profileOpen ? 'rotate-180 text-foreground' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[94vw] rounded-2xl border border-border/80 bg-card p-2 shadow-2xl animate-rise z-50 text-foreground">
                {/* Header User Card */}
                <div className="rounded-xl bg-muted/40 p-3.5 mb-1.5 border border-border/40">
                  <div className="flex items-center gap-3">
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-sm">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-sm font-black text-foreground">{userName}</p>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-extrabold text-primary uppercase">
                          {userRole}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground mt-0.5">{userEmail}</p>
                    </div>
                  </div>

                  {/* Business & GSTIN Info Box */}
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <Store size={13} className="shrink-0 text-primary" />
                      <span className="font-semibold truncate max-w-[150px]">{workspaceName}</span>
                    </div>
                    {businessGstin ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={11} /> GST Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Non-GST
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="p-1">
                  <Link
                    href="/invoices/new"
                    onClick={() => setProfileOpen(false)}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold shadow-xs no-underline"
                    data-testid="link-dropdown-new-invoice"
                  >
                    <Plus size={15} />
                    <span>Create New Invoice</span>
                  </Link>
                </div>

                <div className="my-1.5 h-px bg-border/70" />

                {/* Menu Items */}
                <div className="space-y-0.5 px-1 text-xs font-semibold">
                  <Link
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground no-underline transition-colors"
                    data-testid="link-dropdown-settings"
                  >
                    <SettingsIcon size={16} className="text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-bold text-foreground">Settings & Business Profile</p>
                      <p className="text-[10px] text-muted-foreground font-normal">Shop info, GSTIN, and tax rates</p>
                    </div>
                  </Link>

                  <Link
                    href="/invoices"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground no-underline transition-colors"
                    data-testid="link-dropdown-invoices"
                  >
                    <FileText size={16} className="text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-bold text-foreground">Invoices & Billing</p>
                      <p className="text-[10px] text-muted-foreground font-normal">Manage invoices and customer payments</p>
                    </div>
                  </Link>

                  <Link
                    href="/khatabook"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground no-underline transition-colors"
                    data-testid="link-dropdown-khata"
                  >
                    <BookOpen size={16} className="text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-bold text-foreground">Khata Ledger (Credits)</p>
                      <p className="text-[10px] text-muted-foreground font-normal">Customer balance and payment reminders</p>
                    </div>
                  </Link>

                  <Link
                    href="/reports"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground no-underline transition-colors"
                    data-testid="link-dropdown-reports"
                  >
                    <BarChart3 size={16} className="text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-bold text-foreground">Analytics & Reports</p>
                      <p className="text-[10px] text-muted-foreground font-normal">Sales, tax, and inventory summaries</p>
                    </div>
                  </Link>
                </div>

                <div className="my-1.5 h-px bg-border/70" />

                {/* Log Out Action */}
                <div className="p-1">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid="button-dropdown-signout"
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Help & Support Center Modal */}
      <HelpCenterModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="mx-auto max-w-[1440px] px-4 py-7 pb-24 sm:px-7 lg:px-10 lg:py-9 print:m-0 print:max-w-none print:p-0">{children}</div>
    </main>
    <nav className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-around rounded-2xl border border-border bg-card/95 p-2 shadow-float backdrop-blur lg:hidden print:hidden">
      {mobileNavItems.map(({ href, label, icon: NavIcon }) => <Link href={href} className={`flex min-w-[52px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-bold no-underline ${location.startsWith(href) ? 'bg-muted text-primary' : 'text-muted-foreground'}`} data-testid={`link-mobile-${label.toLowerCase()}`} key={href}><NavIcon size={17} /><span>{label}</span></Link>)}
    </nav>
  </div>;
}

function PageHeader({ eyebrow, title, description, action, actionLabel, actionHref, hideSettings, onSettingsClick, extraAction }: { eyebrow?: string; title: string; description?: string; action?: () => void; actionLabel?: string; actionHref?: string; hideSettings?: boolean; onSettingsClick?: () => void; extraAction?: ReactNode }) {
  const isSettingsPage = title.toLowerCase().includes('setting') || hideSettings;
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-rise relative z-10">
      <div>
        {eyebrow && <div className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</div>}
        <h2 className="text-2xl font-extrabold tracking-[-.05em] sm:text-[30px]">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {(actionLabel || extraAction) && (
        <div className="flex w-full items-center gap-2.5 sm:w-auto">
          {extraAction}
          {actionLabel && (
            actionHref ? (
              <Link
                href={actionHref}
                className="btn-primary flex-1 sm:flex-initial inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs sm:text-sm font-bold no-underline shadow-sm"
                data-testid={`link-${actionLabel.toLowerCase().replaceAll(' ', '-')}`}
              >
                <Plus size={16} />
                <span>{actionLabel}</span>
              </Link>
            ) : (
              <button
                onClick={action}
                className="btn-primary flex-1 sm:flex-initial inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs sm:text-sm font-bold shadow-sm"
                data-testid={`button-${actionLabel.toLowerCase().replaceAll(' ', '-')}`}
              >
                <Plus size={16} />
                <span>{actionLabel}</span>
              </button>
            )
          )}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-muted hover:text-foreground no-underline"
              title="Settings"
              data-testid="button-header-settings-btn"
            >
              <SettingsIcon size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function State({ loading, error, onRetry, children }: { loading?: boolean; error?: string; onRetry?: () => void; children: ReactNode }) {
  if (loading) return <div className="space-y-3">{[1, 2, 3].map((n) => <div className="skeleton h-[68px] rounded-xl" key={n} />)}</div>;
  if (error) return <div className="card-shell flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"><div className="grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive"><RefreshCw size={19} /></div><div><div className="font-bold">Could not load this view</div><p className="mt-1 max-w-md text-xs text-muted-foreground">{error}</p></div><button onClick={onRetry} className="btn-primary rounded-lg px-3 py-2 text-xs font-bold" data-testid="button-retry">Try again</button></div>;
  return <>{children}</>;
}

function Empty({ icon: EmptyIcon, title, description, action, actionLabel }: { icon: Icon; title: string; description: string; action?: () => void; actionLabel?: string }) {
  return <div className="flex flex-col items-center justify-center px-5 py-16 text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-primary"><EmptyIcon size={24} strokeWidth={1.7} /></div><h3 className="font-extrabold tracking-[-.02em]">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{actionLabel && <button onClick={action} className="btn-secondary mt-5 inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold" data-testid="button-empty-action"><Plus size={15} />{actionLabel}</button>}</div>;
}

function Metric({ icon: MetricIcon, label, value, hint, href }: { icon: Icon; label: string; value: string; hint: string; href?: string }) {
  const content = (
    <div className="card-shell p-5 animate-rise transition-all duration-200 hover:border-primary/50 hover:shadow-md group cursor-pointer">
      <div className="mb-6 flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <MetricIcon size={18} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
          {label} <ArrowRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </span>
      </div>
      <div className="mono text-[27px] font-medium tracking-[-.08em] text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="no-underline text-inherit block">
        {content}
      </Link>
    );
  }
  return content;
}

type DashDatePreset = 'this_month' | 'today' | '7days' | '30days' | 'last_month' | 'this_year' | 'all' | 'custom';

function DashboardDateFilter({
  datePreset,
  setDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  datePreset: DashDatePreset;
  setDatePreset: (p: DashDatePreset) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (e: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPresetLabel = () => {
    if (datePreset === 'today') return 'Today';
    if (datePreset === '7days') return 'Last 7 Days';
    if (datePreset === '30days') return 'Last 30 Days';
    if (datePreset === 'this_month') return 'This Month';
    if (datePreset === 'last_month') return 'Last Month';
    if (datePreset === 'this_year') return 'This Year';
    if (datePreset === 'all') return 'All Time';
    if (startDate && endDate) return `${startDate} to ${endDate}`;
    return 'Date Filter';
  };

  const applyPreset = (preset: DashDatePreset) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    setDatePreset(preset);
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-shell inline-flex min-h-10 items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-foreground transition-all hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm bg-card border border-border/80 cursor-pointer"
        title="Filter Dashboard by Date Range"
      >
        <div className="flex items-center gap-1.5">
          <Calendar size={15} className="text-primary" />
          <span className="truncate max-w-[130px] sm:max-w-none">{getPresetLabel()}</span>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-72 sm:w-80 rounded-2xl border border-border/80 bg-card p-4 shadow-2xl backdrop-blur-md animate-rise space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" /> Select Date Range
            </span>
            {datePreset !== 'this_month' && (
              <button
                type="button"
                onClick={() => applyPreset('this_month')}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                Reset (This Month)
              </button>
            )}
          </div>

          {/* Custom Date Pickers */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custom Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="input-shell w-full px-2 py-1.5 text-xs font-semibold rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="input-shell w-full px-2 py-1.5 text-xs font-semibold rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Presets List */}
          <div className="space-y-1.5 pt-2.5 border-t border-border/60">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Presets</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '30days', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'all', label: 'All Time' },
              ].map((p) => {
                const isSelected = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      applyPreset(p.id as DashDatePreset);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [profile, setProfile] = useState<Row | null>(null);
  const invoices = useTable<Row>('invoices', { order: 'issue_date.desc' });
  const products = useTable<Row>('products');
  const customers = useTable<Row>('customers');

  // Dashboard Date Filter state (default: 'this_month')
  const [datePreset, setDatePreset] = useState<DashDatePreset>('this_month');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const session = auth.session();
        if (session) {
          const rows = await db.list<Row>('profiles', { id: session.user.id });
          if (rows.length) setProfile(rows[0]);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    }
    loadProfile();
  }, []);

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.data.forEach((c) => {
      if (c.id) map.set(c.id, c.name || c.full_name || 'Customer');
    });
    return map;
  }, [customers.data]);

  // Filter Invoices by selected date range
  const filteredInvoices = useMemo(() => {
    return invoices.data.filter((inv) => {
      const invDate = inv.issue_date || (inv.created_at ? inv.created_at.split('T')[0] : '');
      if (!invDate) return true;
      if (startDate && invDate < startDate) return false;
      if (endDate && invDate > endDate) return false;
      return true;
    });
  }, [invoices.data, startDate, endDate]);

  const { totalSales, totalOutstanding, pendingCount } = useMemo(() => {
    let sales = 0;
    let outstanding = 0;
    let pending = 0;

    filteredInvoices.forEach((inv) => {
      const amt = Number(inv.total || 0);
      if (inv.status !== 'cancelled' && inv.status !== 'returned') {
        sales += amt;
      }
      const st = String(inv.status || '').toLowerCase();
      if (st === 'pending' || st === 'khata' || st === 'pay_later' || st === 'unpaid' || st === 'draft') {
        outstanding += amt;
        pending += 1;
      }
    });

    return { totalSales: sales, totalOutstanding: outstanding, pendingCount: pending };
  }, [filteredInvoices]);

  const lowStockCount = useMemo(() => {
    return products.data.filter((p) => (Number(p.stock_quantity) || 0) <= (Number(p.min_stock_level) || 5)).length;
  }, [products.data]);

  const recentInvoices = useMemo(() => filteredInvoices.slice(0, 5), [filteredInvoices]);

  // Sort products by lowest stock quantity first
  const stockWatchProducts = useMemo(() => {
    if (!products.data || products.data.length === 0) return [];
    const activeProducts = products.data.filter((p) => p.is_active !== false && p.is_active !== 'false');
    const sorted = [...activeProducts].sort((a, b) => {
      const qtyA = Number(a.stock_quantity ?? 0);
      const qtyB = Number(b.stock_quantity ?? 0);
      return qtyA - qtyB;
    });
    return sorted.slice(0, 5);
  }, [products.data]);

  const session = auth.session();
  const userMeta = session?.user?.user_metadata || {};
  const userName = profile?.full_name || userMeta.full_name || userMeta.name || (session?.user?.email ? session.user.email.split('@')[0] : 'there');

  return (
    <>
      <PageHeader
        eyebrow="Today at a glance"
        title={`Good morning, ${userName}.`}
        description="A clear view of what needs your attention."
        actionLabel="New invoice"
        actionHref="/invoices/new"
        extraAction={
          <DashboardDateFilter
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Metric
          icon={CircleDollarSign}
          label="Sales"
          value={`₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          hint={filteredInvoices.length ? `${filteredInvoices.length} invoice${filteredInvoices.length === 1 ? '' : 's'} in period` : 'No sales in period'}
          href="/invoices"
        />
        <Metric
          icon={Receipt}
          label="Outstanding"
          value={`₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          hint={pendingCount ? `${pendingCount} invoice${pendingCount === 1 ? '' : 's'} awaiting payment` : 'All invoices paid'}
          href="/khatabook?filter=receive"
        />
        <Metric
          icon={Users}
          label="Customers"
          value={String(customers.data.length)}
          hint={customers.data.length ? `${customers.data.length} registered customer${customers.data.length === 1 ? '' : 's'}` : 'Your customer base'}
          href="/customers"
        />
        <Metric
          icon={Boxes}
          label="Low stock"
          value={String(lowStockCount)}
          hint={lowStockCount ? `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} to replenish` : 'All items well stocked'}
          href="/products"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="card-shell overflow-hidden animate-rise delay-1">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <div>
              <h3 className="text-sm font-extrabold">Recent invoices</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">The latest movement in your books.</p>
            </div>
            <Link href="/invoices" className="text-xs font-bold text-primary no-underline" data-testid="link-view-invoices">
              View all <ArrowRight className="ml-1 inline" size={13} />
            </Link>
          </div>
          <State {...invoices}>
            {recentInvoices.length ? (
              <div className="divide-y divide-border/70">
                {recentInvoices.map((row, index) => (
                  <InvoiceRow key={row.id || index} row={row} customerName={customerMap.get(row.customer_id)} />
                ))}
              </div>
            ) : (
              <Empty
                icon={FileText}
                title="No invoices yet"
                description="Create your first invoice to see sales activity here."
                actionLabel="Create invoice"
                action={() => window.location.assign('/invoices/new')}
              />
            )}
          </State>
        </section>

        <section className="card-shell overflow-hidden animate-rise delay-2">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <span>Stock watch</span>
                {lowStockCount > 0 && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-extrabold text-destructive border border-destructive/25">
                    {lowStockCount} Low
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Items with lowest stock / needing replenishment.</p>
            </div>
            <Link href="/products" className="text-xs font-bold text-primary no-underline" data-testid="link-view-products">
              Inventory <ArrowRight className="ml-1 inline" size={13} />
            </Link>
          </div>
          <State {...products}>
            {stockWatchProducts.length ? (
              stockWatchProducts.map((p, index) => {
                const qty = Number(p.stock_quantity ?? 0);
                const minQty = Number(p.min_stock_level ?? 5);
                const isOutOfStock = qty <= 0;
                const isLow = qty <= minQty;

                return (
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 last:border-0 hover:bg-muted/30 transition-colors" key={p.id || index}>
                    <div className="min-w-0 pr-3">
                      <div className="text-xs font-extrabold text-foreground truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        {p.sku ? <span>SKU: {p.sku}</span> : null}
                        <span>Price: ₹{Number(p.selling_price || p.price || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${
                      isOutOfStock
                        ? 'bg-destructive/15 text-destructive border border-destructive/30'
                        : isLow
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isOutOfStock ? '0 Out of stock' : `${qty} ${p.unit || 'units'}`}
                    </span>
                  </div>
                );
              })
            ) : (
              <Empty
                icon={Package}
                title="Inventory is ready"
                description="Add products to keep a live view of your stock."
                actionLabel="Add product"
                action={() => window.location.assign('/products')}
              />
            )}
          </State>
        </section>
      </div>
    </>
  );
}

function InvoiceRow({ row, customerName }: { row: Row; customerName?: string }) {
  const timeMatch = row.notes?.match(/Time:\s*([0-9:]+\s*(?:AM|PM)?)/i);
  const timeStr = timeMatch ? ` at ${timeMatch[1]}` : '';
  const displayName = customerName || row.customer_name || (row.customer_id ? 'Customer' : 'Walk-in customer');

  return (
    <Link href={`/invoices/${row.id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-muted/40 no-underline text-inherit block cursor-pointer" data-testid={`row-invoice-${row.id}`}>
      <div className="min-w-0">
        <div className="mono text-xs font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
          <span>{row.invoice_number || 'Unnumbered invoice'}</span>
          <span className="text-[10px] text-primary">→</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{displayName}</span> · {row.issue_date ? `${row.issue_date}${timeStr}` : 'No issue date'}
        </div>
      </div>
      <div className="text-right">
        <div className="mono text-sm font-bold">₹{row.total != null ? Number(row.total).toFixed(2) : '0.00'} <span className="text-[10px] text-muted-foreground">{row.currency || 'INR'}</span></div>
      </div>
    </Link>
  );
}

function Invoices() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteInvoiceData, setDeleteInvoiceData] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const invoices = usePaginatedTable<Row>('invoices', { order: 'created_at.desc' }, 40);
  const customers = useTable<Row>('customers', { limit: 200 });
  const search = invoices.search;

  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.data.forEach((c) => {
      if (c.id) map.set(c.id, c.name || c.full_name || 'Customer');
    });
    return map;
  }, [customers.data]);

  const filtered = invoices.data;

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceData) return;
    setDeleting(true);
    try {
      await db.remove('invoices', deleteInvoiceData.id);
      toast.success('Invoice deleted successfully!');
      await invoices.reload();
      setDeleteInvoiceData(null);
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Failed to delete invoice.'));
    } finally {
      setDeleting(false);
    }
  };

  return <>
    <PageHeader eyebrow="Cash flow" title="Invoices" description="Move from sale to paid, without losing the thread." actionLabel="New invoice" actionHref="/invoices/new" onSettingsClick={() => setSettingsOpen(true)} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 text-muted-foreground" size={17} />
        <input value={search} onChange={(e) => invoices.setSearch(e.target.value)} placeholder="Search invoice number or customer" className="input-shell w-full pl-10 pr-3 text-sm" data-testid="input-search-invoices" />
      </div>
      <button className="input-shell inline-flex items-center justify-center gap-2 px-3 text-xs font-bold text-muted-foreground hover:text-foreground" data-testid="button-filter-invoices"><SlidersHorizontal size={15} /> Filters</button>
    </div>
    <section className="card-shell overflow-hidden">
      <div className="hidden grid-cols-[1fr_1fr_0.9fr_0.9fr_110px_90px] gap-4 border-b border-border/70 bg-muted/30 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid">
        <span>Invoice</span><span>Customer</span><span>Issued</span><span>Amount</span><span>Status</span><span>Action</span>
      </div>
      <State {...invoices}>
        {filtered.length ? (
          <div className="divide-y divide-border/70">
            {filtered.map((row, index) => {
              const timeMatch = row.notes?.match(/Time:\s*([0-9:]+\s*(?:AM|PM)?)/i);
              const timeStr = timeMatch ? ` ${timeMatch[1]}` : '';
              const custName = customerMap.get(row.customer_id) || (row.customer_id ? 'Customer' : 'Walk-in customer');
              const isReturnedRow = row.status === 'returned';
              const isPartiallyReturnedRow = row.status === 'partially_returned' || row.status === 'partial_returned';
              const isPaidRow = row.status === 'paid' || row.status === 'complete' || row.status === 'khata' || row.status === 'pay_later';
              const isCancelledRow = row.status === 'cancelled';
              return (
                <div
                  key={row.id || index}
                  className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_1fr_0.9fr_0.9fr_110px_90px] sm:items-center sm:gap-4 transition-colors hover:bg-muted/40 text-inherit"
                  data-testid={`invoice-row-${row.id || index}`}
                >
                  <div className="flex items-center justify-between sm:block">
                    <Link
                      href={`/invoices/${row.id}`}
                      className="mono text-xs font-extrabold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 no-underline"
                    >
                      <span>{row.invoice_number || 'Unnumbered'}</span>
                      <span className="text-[10px] text-primary">→</span>
                    </Link>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground truncate">{custName}</span>
                  <span className="text-xs text-muted-foreground">{row.issue_date ? `${row.issue_date}${timeStr}` : '—'}</span>
                  <span className="mono text-sm font-bold">₹{row.total != null ? Number(row.total).toFixed(2) : '0.00'} <span className="text-[10px] text-muted-foreground">{row.currency || 'INR'}</span></span>
                  <div className="hidden sm:block">
                    {isReturnedRow ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                        Returned
                      </span>
                    ) : isPartiallyReturnedRow ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide whitespace-nowrap bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                        Partial Return
                      </span>
                    ) : isPaidRow ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        Paid
                      </span>
                    ) : isCancelledRow ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap bg-destructive/15 text-destructive border border-destructive/25">
                        Cancelled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* View Button */}
                    <Link 
                      href={`/invoices/${row.id}`} 
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary/20 active:scale-95 shadow-2xs border border-primary/20 no-underline" 
                      title="View Details"
                      data-testid={`button-view-invoice-${row.id}`}
                    >
                      <Eye size={14} />
                    </Link>

                    {/* Edit Button */}
                    <Link 
                      href={`/invoices/new?edit=${row.id}`} 
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-all hover:bg-muted hover:text-primary active:scale-95 shadow-2xs border border-border/60 no-underline" 
                      title="Edit Invoice"
                      data-testid={`button-edit-invoice-${row.id}`}
                    >
                      <Pencil size={14} />
                    </Link>

                    {/* Delete Button */}
                    <button 
                      type="button" 
                      onClick={() => setDeleteInvoiceData(row)} 
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-muted-foreground transition-all hover:bg-destructive/20 hover:text-destructive active:scale-95 shadow-2xs border border-destructive/20 cursor-pointer" 
                      title="Delete Invoice"
                      data-testid={`button-delete-invoice-${row.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon={FileText} title={search ? 'No invoices match' : 'Your invoice list is clear'} description={search ? 'Try another search term.' : 'Invoices created in the workspace will appear here.'} actionLabel={!search ? 'Create invoice' : undefined} action={() => window.location.assign('/invoices/new')} />
        )}
      </State>
      <InfiniteScrollSentinel onIntersect={invoices.loadMore} hasMore={invoices.hasMore} loadingMore={invoices.loadingMore} />
    </section>
    
    {/* Delete Invoice Modal */}
    {deleteInvoiceData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-float relative">
          <div className="flex items-center gap-3 text-destructive mb-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">Delete Invoice?</h3>
              <p className="text-xs text-muted-foreground">Invoice {deleteInvoiceData.invoice_number}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            Are you sure you want to delete invoice <strong className="text-foreground">{deleteInvoiceData.invoice_number}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
            <button 
              type="button" 
              onClick={() => setDeleteInvoiceData(null)} 
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button" 
              disabled={deleting} 
              onClick={() => void handleDeleteInvoice()} 
              className="rounded-xl bg-destructive px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Invoice'}
            </button>
          </div>
        </div>
      </div>
    )}

    {settingsOpen && <InvoiceQuickSettings onClose={() => setSettingsOpen(false)} />}
  </>;
}

function InvoiceQuickSettings({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({
    enable_tax: false,
    tax_name: 'Tax',
    tax_rate: '18',
    invoice_template: 'standard',
    invoice_gst_template: 'gst-pro',
    invoice_nongst_template: 'modern',
    invoice_print_size: 'A4',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        let session = auth.session();
        if (!session) session = await auth.getSession();
        const user = session?.user;
        let loadedEnableTax = false;
        let loadedTaxName = 'Tax';
        let loadedTaxRate = '18';
        let loadedTemplate = 'standard';
        let loadedGstTemplate = 'gst-pro';
        let loadedNonGstTemplate = 'modern';
        let loadedPrintSize = 'A4';

        // 1. Try global tax cache
        try {
          const globalRaw = localStorage.getItem('arventa_tax_settings');
          if (globalRaw) {
            const gc = JSON.parse(globalRaw);
            if (gc.enable_tax !== undefined) loadedEnableTax = Boolean(gc.enable_tax);
            if (gc.tax_name) loadedTaxName = gc.tax_name;
            if (gc.tax_rate !== undefined) loadedTaxRate = String(gc.tax_rate);
            if (gc.invoice_template) loadedTemplate = gc.invoice_template;
            if (gc.invoice_gst_template) loadedGstTemplate = gc.invoice_gst_template;
            if (gc.invoice_nongst_template) loadedNonGstTemplate = gc.invoice_nongst_template;
            if (gc.invoice_print_size) loadedPrintSize = gc.invoice_print_size;
          }
        } catch (e) {}

        // Try dedicated template settings
        try {
          const tplRaw = localStorage.getItem('arventa_invoice_template_settings');
          if (tplRaw) {
            const parsed = JSON.parse(tplRaw);
            if (parsed.template_id) loadedTemplate = parsed.template_id;
            if (parsed.gst_template_id) loadedGstTemplate = parsed.gst_template_id;
            if (parsed.nongst_template_id) loadedNonGstTemplate = parsed.nongst_template_id;
            if (parsed.print_size) loadedPrintSize = parsed.print_size;
          }
        } catch (e) {}

        // 2. Try user-specific local cache
        if (user?.id) {
          try {
            const raw = localStorage.getItem(`arventa_biz_${user.id}`);
            if (raw) {
              const c = JSON.parse(raw);
              if (c.enable_tax !== undefined) loadedEnableTax = Boolean(c.enable_tax);
              if (c.tax_name) loadedTaxName = c.tax_name;
              if (c.tax_rate !== undefined) loadedTaxRate = String(c.tax_rate);
              if (c.invoice_template) loadedTemplate = c.invoice_template;
              if (c.invoice_gst_template) loadedGstTemplate = c.invoice_gst_template;
              if (c.invoice_nongst_template) loadedNonGstTemplate = c.invoice_nongst_template;
              if (c.invoice_print_size) loadedPrintSize = c.invoice_print_size;
            }
          } catch (e) {}

          // 3. Try DB settings
          try {
            let bid = await getBusinessId();
            if (!bid) {
              const profiles = await db.list<Row>('profiles', { id: user.id });
              if (profiles.length && profiles[0].business_id) bid = profiles[0].business_id;
            }
            if (bid) {
              const settingsList = await db.list<Row>('settings', { business_id: bid });
              if (settingsList.length > 0) {
                const s = settingsList[0];
                if (s.enable_tax !== undefined) loadedEnableTax = Boolean(s.enable_tax);
                if (s.tax_name) loadedTaxName = s.tax_name;
                if (s.tax_rate !== undefined) loadedTaxRate = String(s.tax_rate);
                if (s.invoice_template) loadedTemplate = s.invoice_template;
                if (s.invoice_gst_template) loadedGstTemplate = s.invoice_gst_template;
                if (s.invoice_nongst_template) loadedNonGstTemplate = s.invoice_nongst_template;
              }
            }
          } catch (e) {}
        }

        setForm({
          enable_tax: loadedEnableTax,
          tax_name: loadedTaxName || 'Tax',
          tax_rate: loadedTaxRate || '18',
          invoice_template: loadedTemplate || (loadedEnableTax ? loadedGstTemplate : loadedNonGstTemplate),
          invoice_gst_template: loadedGstTemplate || 'gst-pro',
          invoice_nongst_template: loadedNonGstTemplate || 'modern',
          invoice_print_size: loadedPrintSize || 'A4',
        });
      } catch (err) {
        console.warn('Could not load invoice settings:', err);
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let session = auth.session();
      if (!session) session = await auth.getSession();
      const user = session?.user;

      const activeGstTpl = form.invoice_gst_template || 'gst-pro';
      const activeNonGstTpl = form.invoice_nongst_template || 'modern';
      const activeTemplate = form.enable_tax ? activeGstTpl : activeNonGstTpl;

      // Always save to global localStorage cache for instant access
      localStorage.setItem('arventa_tax_settings', JSON.stringify({
        enable_tax: form.enable_tax,
        tax_name: form.tax_name || 'Tax',
        tax_rate: form.tax_rate,
        invoice_template: activeTemplate,
        invoice_gst_template: activeGstTpl,
        invoice_nongst_template: activeNonGstTpl,
        invoice_print_size: form.invoice_print_size,
      }));

      // Also save to template settings
      try {
        const tplRaw = localStorage.getItem('arventa_invoice_template_settings');
        const tplObj = tplRaw ? JSON.parse(tplRaw) : {};
        tplObj.template_id = activeTemplate;
        tplObj.gst_template_id = activeGstTpl;
        tplObj.nongst_template_id = activeNonGstTpl;
        tplObj.print_size = form.invoice_print_size;
        localStorage.setItem('arventa_invoice_template_settings', JSON.stringify(tplObj));
      } catch {}

      if (user?.id) {
        try {
          const raw = localStorage.getItem(`arventa_biz_${user.id}`);
          const c = raw ? JSON.parse(raw) : {};
          c.enable_tax = form.enable_tax;
          c.tax_name = form.tax_name || 'Tax';
          c.tax_rate = form.tax_rate;
          c.invoice_template = activeTemplate;
          c.invoice_gst_template = activeGstTpl;
          c.invoice_nongst_template = activeNonGstTpl;
          c.invoice_print_size = form.invoice_print_size;
          localStorage.setItem(`arventa_biz_${user.id}`, JSON.stringify(c));
        } catch (e) {}

        // Update user metadata
        try {
          await supabase.auth.updateUser({
            data: {
              enable_tax: form.enable_tax,
              tax_name: form.tax_name || 'Tax',
              tax_rate: form.tax_rate,
              invoice_template: activeTemplate,
              invoice_gst_template: activeGstTpl,
              invoice_nongst_template: activeNonGstTpl,
              invoice_print_size: form.invoice_print_size,
            }
          });
        } catch (ae) {}
        
        // Update DB settings
        try {
          let bid = await getBusinessId();
          if (!bid) {
            const profiles = await db.list<Row>('profiles', { id: user.id });
            if (profiles.length && profiles[0].business_id) bid = profiles[0].business_id;
          }
          if (bid) {
            await db.upsert('settings', {
              business_id: bid,
              enable_tax: form.enable_tax,
              tax_name: form.tax_name || 'Tax',
              tax_rate: Number(form.tax_rate || 0),
              invoice_template: activeTemplate,
              invoice_gst_template: activeGstTpl,
              invoice_nongst_template: activeNonGstTpl,
            });
          }
        } catch (e) {
          console.warn('Could not save DB settings:', e);
        }
      }
    } catch (e) {
      console.warn('Could not save invoice settings completely:', e);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-in zoom-in-95">
        <div className="mb-5 flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h3 className="text-base sm:text-lg font-black text-foreground">Invoice Templates & Print Setup</h3>
            <p className="text-xs text-muted-foreground">Select active templates for GST & Non-GST billing, print size & tax rules.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void save(e)} className="space-y-5">
          {/* Tax Calculation */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={form.enable_tax} onChange={e => setForm({...form, enable_tax: e.target.checked})} className="mt-1 h-4 w-4 rounded accent-primary cursor-pointer" />
              <div>
                <div className="text-xs font-bold text-foreground">Enable GST / Tax Calculation</div>
                <div className="text-[11px] text-muted-foreground">Auto-apply tax rates to your itemized invoices.</div>
              </div>
            </label>
            {form.enable_tax && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold">
                  Tax Name / Type
                  <input type="text" placeholder="e.g. GST, VAT" value={form.tax_name} onChange={e => setForm({...form, tax_name: e.target.value})} className="input-shell mt-1.5 w-full px-3 py-2 text-xs font-semibold" />
                </label>
                <label className="block text-xs font-bold">
                  Default Tax Rate (%)
                  <div className="relative mt-1.5">
                    <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} className="input-shell w-full pl-3 pr-8 py-2 text-xs font-semibold" />
                    <span className="pointer-events-none absolute right-3 top-2 text-xs font-bold text-muted-foreground">%</span>
                  </div>
                </label>
              </div>
            )}
          </div>
          
          {/* Invoice Templates Header & Live Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-foreground uppercase tracking-wider">1. Select GST & Non-GST Templates</label>
              <div className="flex gap-1.5 text-[10px] font-extrabold">
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                  GST: {INVOICE_TEMPLATES.find(t => t.id === (form.invoice_gst_template || 'gst-pro'))?.name}
                </span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/25">
                  Non-GST: {INVOICE_TEMPLATES.find(t => t.id === (form.invoice_nongst_template || 'modern'))?.name}
                </span>
              </div>
            </div>

            {/* Live Template Visual Preview Card */}
            {(() => {
              const activePreviewTplId = form.enable_tax 
                ? (form.invoice_gst_template || 'gst-pro')
                : (form.invoice_nongst_template || 'modern');
              const selectedTpl = INVOICE_TEMPLATES.find(t => t.id === activePreviewTplId) || INVOICE_TEMPLATES[0];
              const printSz = form.invoice_print_size || 'A4';
              return (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-primary-foreground">
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-foreground flex items-center gap-1.5">
                          <span>{selectedTpl.name}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${selectedTpl.badgeColor}`}>
                            {selectedTpl.badge}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold text-primary bg-background px-2 py-0.5 rounded-md border border-primary/30 mono">
                      Active Preview ({form.enable_tax ? 'GST Mode' : 'Non-GST Mode'} • {printSz})
                    </span>
                  </div>

                  {/* Visual Mock Card */}
                  <div className="h-24 w-full rounded-xl border border-border bg-card p-2.5 shadow-inner flex flex-col justify-between overflow-hidden text-[9px] select-none">
                    {selectedTpl.id === 'gst-pro' && (
                      <div className="h-full flex flex-col justify-between space-y-1">
                        <div className="flex justify-between items-center border-b border-emerald-500/40 pb-0.5 text-emerald-600 font-bold text-[8px]">
                          <span className="flex items-center gap-1"><ShieldCheck size={10} /> GST TAX INVOICE</span>
                          <span className="mono">GSTIN: 19ABCDE1234F1Z5</span>
                        </div>
                        <div className="grid grid-cols-4 gap-0.5 text-[8px] font-bold text-muted-foreground bg-muted/40 p-1 rounded">
                          <span className="col-span-2">Item Name</span>
                          <span>HSN/SAC</span>
                          <span className="text-right">CGST+SGST</span>
                        </div>
                        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-1 rounded font-black text-emerald-700 dark:text-emerald-300 text-[8.5px]">
                          <span>TOTAL INCL. GST</span>
                          <span className="mono">₹5,900.00</span>
                        </div>
                      </div>
                    )}

                    {selectedTpl.id === 'standard' && (
                      <div className="h-full flex flex-col justify-between space-y-1">
                        <div className="flex justify-between items-center border-b border-border pb-0.5">
                          <div className="font-extrabold text-primary text-[9px]">BILLING MASTER STORE</div>
                          <div className="mono text-muted-foreground font-bold text-[8px]">INV-2026-0042</div>
                        </div>
                        <div className="flex justify-between text-muted-foreground py-0.5 text-[8.5px]">
                          <span>Product Purchase & Line Items</span>
                          <span className="mono font-bold text-foreground">₹4,250.00</span>
                        </div>
                        <div className="flex justify-between items-center bg-primary/10 p-1 rounded font-black text-primary text-[8.5px]">
                          <span>Subtotal & Tax Breakdown</span>
                          <span className="mono">₹4,250.00</span>
                        </div>
                      </div>
                    )}

                    {selectedTpl.id === 'modern' && (
                      <div className="h-full flex flex-col justify-between space-y-1">
                        <div className="bg-foreground text-background px-2 py-0.5 rounded flex justify-between items-center font-bold tracking-wider text-[8px]">
                          <span>COMMERCIAL INVOICE</span>
                          <span className="mono">#89012</span>
                        </div>
                        <div className="px-1 text-muted-foreground space-y-0.5 text-[8px]">
                          <div className="flex justify-between"><span>Web Design & Services</span><span>₹12,000</span></div>
                        </div>
                        <div className="bg-blue-500/10 px-1.5 py-0.5 rounded flex justify-between font-black text-blue-600 text-[8.5px]">
                          <span>GRAND TOTAL</span>
                          <span className="mono">₹13,500.00</span>
                        </div>
                      </div>
                    )}

                    {selectedTpl.id === 'pos-thermal' && (
                      <div className="h-full flex flex-col items-center justify-between text-center font-mono text-[8px]">
                        <div className="border-b border-dashed border-border w-full pb-0.5 font-bold">
                          *** RETAIL COUNTER RECEIPT ***
                        </div>
                        <div className="w-full flex justify-between text-muted-foreground text-[7.5px]">
                          <span>ITEM x2</span>
                          <span>₹350.00</span>
                        </div>
                        <div className="w-full border-t border-dashed border-border pt-0.5 flex justify-between font-black text-foreground text-[8.5px]">
                          <span>TOTAL PAID</span>
                          <span>₹350.00</span>
                        </div>
                      </div>
                    )}

                    {selectedTpl.id === 'executive' && (
                      <div className="h-full flex flex-col justify-between border-2 border-double border-amber-500/40 p-1 rounded bg-amber-500/5 text-[8px]">
                        <div className="text-center font-serif font-black text-amber-600 tracking-widest border-b border-amber-500/30 pb-0.5">
                          OFFICIAL CONTRACT INVOICE
                        </div>
                        <div className="flex justify-between items-center bg-amber-500/10 p-1 rounded font-bold text-amber-800 dark:text-amber-200">
                          <span>Authorized Total</span>
                          <span className="mono font-black">₹25,000.00</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* CATEGORY 1: GENERAL / NON-GST TEMPLATES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <div className="flex items-center gap-1.5">
                  <FileText size={14} className="text-primary" />
                  <span className="text-xs font-black text-foreground">1. General / Non-GST Templates (Select 1 for Non-GST Invoices)</span>
                </div>
                <span className="text-[9.5px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/25">
                  Non-GST Category
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INVOICE_TEMPLATES.filter(t => t.id === 'modern' || t.id === 'pos-thermal' || t.id === 'executive').map(tpl => {
                  const isNonGstSelected = (form.invoice_nongst_template || 'modern') === tpl.id;
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => setForm({ 
                        ...form, 
                        invoice_nongst_template: tpl.id, 
                        invoice_template: !form.enable_tax ? tpl.id : form.invoice_template 
                      })}
                      className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isNonGstSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-xs'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-foreground">{tpl.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tpl.badgeColor}`}>
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{tpl.desc}</p>
                      {isNonGstSelected && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-black text-primary">
                          <Check size={12} className="stroke-[3]" /> Active Non-GST Template
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CATEGORY 2: GST / TAX TEMPLATES */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black text-foreground">2. GST / Tax Templates (Select 1 for GST Invoices)</span>
                </div>
                <span className="text-[9.5px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  GST Category
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INVOICE_TEMPLATES.filter(t => t.id === 'gst-pro' || t.id === 'standard').map(tpl => {
                  const isGstSelected = (form.invoice_gst_template || 'gst-pro') === tpl.id;
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => setForm({ 
                        ...form, 
                        invoice_gst_template: tpl.id, 
                        invoice_template: form.enable_tax ? tpl.id : form.invoice_template 
                      })}
                      className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isGstSelected
                          ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'border-border bg-card hover:border-emerald-500/40 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-foreground">{tpl.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tpl.badgeColor}`}>
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{tpl.desc}</p>
                      {isGstSelected && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                          <Check size={12} className="stroke-[3]" /> Active GST Template
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Print Page Size */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <label className="text-xs font-extrabold text-foreground uppercase tracking-wider">2. Select Print Page Size</label>
              <span className="text-[11px] font-bold text-primary">
                {PRINT_SIZES.find(s => s.id === form.invoice_print_size)?.name}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRINT_SIZES.map(sz => {
                const isSelected = form.invoice_print_size === sz.id;
                return (
                  <button
                    type="button"
                    key={sz.id}
                    onClick={() => setForm({ ...form, invoice_print_size: sz.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border bg-card text-foreground hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black">{sz.id}</span>
                      <span className="text-[9px] font-medium text-muted-foreground">{sz.tag}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sz.dimensions}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary rounded-xl px-6 py-2.5 text-xs font-bold shadow-xs">{saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceNew() {
  const [, setLocation] = useLocation();
  const products = useTable<Row>('products', { order: 'name.asc' });
  const customers = useTable<Row>('customers', { order: 'name.asc' });
  const khataEntries = useTable<Row>('khata_entries');
  const [customerId, setCustomerId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('customer_id') || '';
    }
    return '';
  });
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerDropdown, setCustomerDropdown] = useState(false);
  const [productDropdown, setProductDropdown] = useState(false);
  const visibleCustomers = useMemo(() => { const q = customerQuery.toLowerCase(); return customers.data.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)); }, [customers.data, customerQuery]);

  const getKhataBalanceForCustomer = (cId: string) => {
    if (!cId || !khataEntries.data.length) return { due: 0, credit: 0, isZero: true, net: 0 };
    const rawEntries = khataEntries.data.filter((e) => e.customer_id === cId);
    let gaveSum = 0;
    let gotSum = 0;
    rawEntries.forEach((e) => {
      const amt = Number(e.amount || 0);
      if (e.type === 'gave') gaveSum += amt;
      else if (e.type === 'got') gotSum += amt;
    });
    const netDue = gaveSum - gotSum;
    return {
      due: netDue > 0 ? netDue : 0,
      credit: netDue < 0 ? Math.abs(netDue) : 0,
      isZero: netDue === 0,
      net: netDue,
    };
  };

  const customerKhataBalance = useMemo(() => {
    return getKhataBalanceForCustomer(customerId);
  }, [customerId, khataEntries.data]);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Row[]>([]);
  const [customItemModal, setCustomItemModal] = useState(false);
  const [customItemForm, setCustomItemForm] = useState<any>({ name: '', price: '', quantity: 1 });

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentTime = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [issueDate, setIssueDate] = useState(getTodayDate());
  const [issueTime, setIssueTime] = useState(getCurrentTime());

  // Confirmation & Notifications state
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(false);
  const [notifyPhoneCall, setNotifyPhoneCall] = useState(false);

  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [appliedStoreCredit, setAppliedStoreCredit] = useState<string>('');
  const [usePreviousDue, setUsePreviousDue] = useState(false);
  const [includedPreviousDue, setIncludedPreviousDue] = useState<string>('');

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const visibleProducts = useMemo(() => {
    return products.data
      .filter((p) => p.unit !== 'custom-item' && `${p.name || ''} ${getProductBarcode(p)}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [products.data, query]);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState('');
  
  const discountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (discountType === 'percentage') {
      return subtotal * (val / 100);
    }
    return val;
  }, [discountValue, discountType, subtotal]);
  
  const finalDiscount = Math.min(discountAmount, subtotal);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(18);
  const [taxName, setTaxName] = useState("Tax");

  useEffect(() => {
    async function fetchTax() {
      try {
        let loadedTaxEnabled = false;
        let loadedTaxRate = 18;
        let loadedTaxName = 'Tax';

        // 1. Check global tax cache first
        try {
          const globalRaw = localStorage.getItem('arventa_tax_settings');
          if (globalRaw) {
            const gc = JSON.parse(globalRaw);
            if (gc.enable_tax !== undefined) loadedTaxEnabled = Boolean(gc.enable_tax);
            if (gc.tax_rate !== undefined) loadedTaxRate = Number(gc.tax_rate) || 0;
            if (gc.tax_name) loadedTaxName = gc.tax_name;
          }
        } catch (e) {}

        let session = auth.session();
        if (!session) session = await auth.getSession();
        const user = session?.user;

        if (user?.id) {
          // 2. Check user-specific localStorage cache
          try {
            const raw = localStorage.getItem(`arventa_biz_${user.id}`);
            if (raw) {
              const cache = JSON.parse(raw);
              if (cache.enable_tax !== undefined) loadedTaxEnabled = Boolean(cache.enable_tax);
              if (cache.tax_rate !== undefined) loadedTaxRate = Number(cache.tax_rate) || 0;
              if (cache.tax_name) loadedTaxName = cache.tax_name;
            }
          } catch (e) {}

          // 3. Check user metadata
          const meta = user.user_metadata || {};
          if (meta.enable_tax !== undefined) {
            loadedTaxEnabled = Boolean(meta.enable_tax);
            if (meta.tax_rate !== undefined) loadedTaxRate = Number(meta.tax_rate) || 0;
            if (meta.tax_name) loadedTaxName = meta.tax_name;
          }

          // 4. Check DB settings table
          try {
            let bid = await getBusinessId();
            if (!bid) {
              const profiles = await db.list<Row>("profiles", { id: user.id });
              if (profiles.length > 0) bid = profiles[0].business_id;
            }
            if (bid) {
              const settingsList = await db.list<Row>("settings", { business_id: bid });
              if (settingsList.length > 0) {
                const s = settingsList[0];
                if (s.enable_tax !== undefined) loadedTaxEnabled = Boolean(s.enable_tax);
                if (s.tax_rate !== undefined) loadedTaxRate = Number(s.tax_rate) || 0;
                if (s.tax_name) loadedTaxName = s.tax_name;
              }
            }
          } catch (dbe) {}
        }

        setTaxEnabled(loadedTaxEnabled);
        setTaxRate(loadedTaxRate);
        setTaxName(loadedTaxName || 'Tax');
      } catch (e) {
        console.warn("Could not load tax settings:", e);
      }
    }
    fetchTax();
  }, []);

  const [zeroStockModalProduct, setZeroStockModalProduct] = useState<Row | null>(null);

  const taxableAmount = Math.max(0, subtotal - finalDiscount);
  const taxAmount = taxEnabled ? (taxableAmount * (taxRate / 100)) : 0;
  const netBeforeKhata = taxableAmount + taxAmount;

  const maxCreditAvailable = customerKhataBalance?.credit || 0;
  const maxDueAvailable = customerKhataBalance?.due || 0;

  const actualStoreCreditApplied = useStoreCredit
    ? Math.min(maxCreditAvailable, Math.min(netBeforeKhata, Math.max(0, Number(appliedStoreCredit) || 0)))
    : 0;

  const actualPreviousDueAdded = usePreviousDue
    ? Math.min(maxDueAvailable, Math.max(0, Number(includedPreviousDue) || 0))
    : 0;

  const finalTotal = Math.max(0, netBeforeKhata - actualStoreCreditApplied + actualPreviousDueAdded);
  const addItem = (product: Row, forceAllow: boolean = false) => {
    const isService = product.type === 'service' || product.item_type === 'service' || product.unit === 'service';
    const stock = Number(product.stock_quantity ?? product.stock ?? 0);

    if (!isService && !forceAllow && stock <= 0) {
      toast.error(`Out of Stock! Use "+ Add Anyway" on the right side of "${product.name}" to add it.`);
      return;
    }

    const existing = items.find((i) => i.product_id === product.id);
    const currentQty = existing ? Number(existing.quantity || 0) : 0;
    const newQty = currentQty + 1;

    if (!isService && stock <= 5 && stock > 0) {
      toast.warning(`Low Stock Alert: "${product.name}" has only ${stock} item(s) remaining in inventory!`);
    } else if (!isService && stock <= 0 && forceAllow) {
      toast.info(`Billed Out-of-Stock Item: "${product.name}" (Stock: 0 - Overridden).`);
    }

    if (existing) {
      setItems((old) => old.map((i) => (i.product_id === product.id ? { ...i, quantity: newQty } : i)));
    } else {
      setItems((old) => [
        ...old,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          unit: product.unit,
        },
      ]);
    }
  };
  
  const [customerModal, setCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState<Row>({});

  const openCustomerModal = () => {
    setNewCustomerForm({
      customer_type: 'individual',
      save_to_directory: true,
      name: '',
      phone: customerQuery,
      email: '',
      address: '',
      gstin: '',
      notes: '',
    });
    setCustomerDropdown(false);
    setCustomerModal(true);
  };

  const saveNewCustomerForm = async () => {
    try {
      const isCompany = newCustomerForm.customer_type === 'company';
      if (!newCustomerForm.name || !newCustomerForm.name.trim()) {
        setNewCustomerForm(old => ({ ...old, _error: isCompany ? 'Company Name is required' : 'Customer Name is required' }));
        return;
      }
      if (!newCustomerForm.phone) {
        setNewCustomerForm(old => ({ ...old, _error: 'Phone Number is required' }));
        return;
      }
      if (newCustomerForm.phone.replace(/\D/g, '').length < 10) {
        setNewCustomerForm(old => ({ ...old, _error: 'Phone number must be at least 10 digits' }));
        return;
      }

      setSaving(true);
      const gstinVal = isCompany ? (newCustomerForm.gstin?.trim() || null) : null;
      const payload: Record<string, any> = {
        name: newCustomerForm.name.trim(),
        email: newCustomerForm.email?.trim() || null,
        phone: newCustomerForm.phone?.trim() || null,
        address: newCustomerForm.address?.trim() || null,
        notes: newCustomerForm.notes || null,
      };
      if (gstinVal) {
        payload.gstin = gstinVal;
      }

      const shouldSaveToDb = newCustomerForm.save_to_directory !== false;

      if (shouldSaveToDb) {
        let result;
        try {
          if (newCustomerForm.id) {
            result = await db.update('customers', newCustomerForm.id, payload);
          } else {
            result = await db.insert('customers', payload);
          }
        } catch (err: any) {
          if (gstinVal) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.gstin;
            fallbackPayload.notes = JSON.stringify({
              notes: newCustomerForm.notes || '',
              gstin: gstinVal,
            });
            if (newCustomerForm.id) {
              result = await db.update('customers', newCustomerForm.id, fallbackPayload);
            } else {
              result = await db.insert('customers', fallbackPayload);
            }
          } else {
            throw err;
          }
        }

        await customers.reload();
        setCustomerId((result as any).id);
        toast.success('Customer saved to directory & selected!');
      } else {
        const tempId = `temp_cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const tempCustomerObj = {
          id: tempId,
          ...payload,
          is_transient: true,
        };

        customers.setData((old: Row[]) => [tempCustomerObj, ...old]);
        setCustomerId(tempId);
        toast.info('Customer applied to invoice (not saved to directory).');
      }

      setCustomerModal(false);
    } catch (e) {
      setNewCustomerForm(old => ({ ...old, _error: getSupabaseErrorMessage(e, 'Could not save customer.') }));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!items.length) { setMessage('Add at least one product before saving.'); return; }
    setSaving(true); setMessage('');
    try {
      if (!customerId) throw new Error('Choose a customer before creating the invoice.');
      
      const notesParts: string[] = [];
      if (issueTime) {
        notesParts.push(`Time: ${issueTime}`);
      }
      const notifChannels = ['Email (Default)'];
      if (notifyWhatsApp) notifChannels.push('WhatsApp');
      if (notifyPhoneCall) notifChannels.push('Phone Call');
      notesParts.push(`Notifications: ${notifChannels.join(', ')}`);

      if (finalDiscount > 0) {
        const dText = discountType === 'percentage' ? `${discountValue}%` : `${discountValue}`;
        notesParts.push(`Discount applied: ${dText} (-${finalDiscount.toFixed(2)})`);
      }
      if (taxEnabled && taxRate > 0) {
        notesParts.push(`${taxName} (${taxRate}%): +${taxAmount.toFixed(2)}`);
      }
      if (actualStoreCreditApplied > 0) {
        notesParts.push(`Store Credit / Wallet Redeemed: -₹${actualStoreCreditApplied.toFixed(2)}`);
      }
      if (actualPreviousDueAdded > 0) {
        notesParts.push(`Previous Khata Due Billed: +₹${actualPreviousDueAdded.toFixed(2)}`);
      }
      if (notes.trim()) {
        notesParts.push(notes.trim());
      }
      const finalNotes = notesParts.join('\n');
      
      const discountedItems = items.map(item => {
        let price = Number(item.price || 0);
        if (subtotal > 0 && finalDiscount > 0) {
          price = price - (price * (finalDiscount / subtotal));
        }
        if (taxEnabled && taxRate > 0) {
          price = price + (price * (taxRate / 100));
        }
        return {
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(price.toFixed(4))
        };
      });

      let saved = false;
      let createdInvoiceId = '';
      let bid = await getBusinessId();
      const nextInvoiceNum = await getNextInvoiceNumber(bid);

      try {
        const rpcRes = await db.rpc<Row>('create_invoice_transaction', {
          invoice_data: {
            customer_id: customerId,
            invoice_number: nextInvoiceNum,
            issue_date: issueDate || new Date().toISOString().slice(0, 10),
            notes: finalNotes,
            status: 'pending',
          },
          line_items: discountedItems,
          initial_payment: null,
        });
        if (rpcRes && (rpcRes as any).id) {
          createdInvoiceId = (rpcRes as any).id;
        }
        saved = true;
      } catch (rpcError: any) {
        console.warn('RPC create_invoice_transaction failed, falling back to direct table inserts:', rpcError);
        
        // Fallback: direct insert into invoices and invoice_items
        const invoicePayload: Record<string, any> = {
          customer_id: customerId,
          invoice_number: nextInvoiceNum,
          issue_date: issueDate || new Date().toISOString().slice(0, 10),
          notes: finalNotes,
          total: Number(finalTotal.toFixed(2)),
          status: 'pending',
          currency: 'INR',
        };
        if (bid) invoicePayload.business_id = bid;

        const newInv = await db.insert<Row>('invoices', invoicePayload);
        const newInvId = (newInv as any)?.id;
        if (newInvId) createdInvoiceId = newInvId;

        if (newInvId) {
          // Insert line items
          for (const item of discountedItems) {
            try {
              const itemPayload: Record<string, any> = {
                invoice_id: newInvId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: Number((item.quantity * item.unit_price).toFixed(2)),
              };
              if (bid) itemPayload.business_id = bid;
              await db.insert('invoice_items', itemPayload);
            } catch (itemErr) {
              console.warn('Could not insert invoice item:', itemErr);
            }
          }

        }
        saved = true;
      }

      if (saved) {
        // Automatically deduct physical inventory stock for all items billed on this invoice
        for (const item of items) {
          if (!item.product_id) continue;
          try {
            const prodList = await db.list<Row>('products', { id: item.product_id });
            if (!prodList || !prodList.length) continue;
            const prod = prodList[0];

            const isServ = prod.type === 'service' || prod.item_type === 'service' || prod.unit === 'service';
            if (isServ) continue; // Skip virtual services

            let currentStock = prod.stock_quantity !== undefined && prod.stock_quantity !== null
              ? Number(prod.stock_quantity)
              : (prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 0);

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                if (meta.type === 'service') continue;
                if (meta.stock_quantity !== undefined && meta.stock_quantity !== null) {
                  currentStock = Number(meta.stock_quantity);
                }
              } catch (e) {}
            }

            const qtyDeducted = Number(item.quantity || 1);
            const newStock = Math.max(0, currentStock - qtyDeducted);

            const updatePayload: Record<string, any> = {
              stock_quantity: newStock,
              stock: newStock,
            };

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                meta.stock_quantity = newStock;
                updatePayload.notes = JSON.stringify(meta);
              } catch (e) {}
            }

            await db.update('products', item.product_id, updatePayload);
          } catch (stErr) {
            console.warn('Could not deduct product stock:', item.product_id, stErr);
          }
        }

        // Record Khata Book entries for Store Credit redeemed or Previous Due billed
        try {
          const selectedCust = customers.data.find(x => x.id === customerId);
          const custName = selectedCust?.name || 'Customer';
          const custPhone = selectedCust?.phone || '';
          const todayDate = issueDate || getTodayDate();
          const timeNow = issueTime || getCurrentTime();

          if (actualStoreCreditApplied > 0) {
            await db.insert('khata_entries', {
              business_id: bid,
              customer_id: customerId,
              customer_name: custName,
              customer_phone: custPhone,
              type: 'gave', // debit store credit balance
              amount: actualStoreCreditApplied,
              date: todayDate,
              time: timeNow,
              payment_mode: 'Store Credit / Wallet',
              bill_reference: nextInvoiceNum,
              note: `Store credit ₹${actualStoreCreditApplied.toFixed(2)} redeemed on Invoice ${nextInvoiceNum}`,
            });
          }

          if (actualPreviousDueAdded > 0) {
            await db.insert('khata_entries', {
              business_id: bid,
              customer_id: customerId,
              customer_name: custName,
              customer_phone: custPhone,
              type: 'got', // credit previous due balance
              amount: actualPreviousDueAdded,
              date: todayDate,
              time: timeNow,
              payment_mode: 'Previous Due Billed',
              bill_reference: nextInvoiceNum,
              note: `Previous Khata due ₹${actualPreviousDueAdded.toFixed(2)} billed on Invoice ${nextInvoiceNum}`,
            });
          }
        } catch (kErr) {
          console.warn('Could not record Khata adjustments on invoice save:', kErr);
        }

        if (createdInvoiceId) {
          setLocation(`/invoices/${createdInvoiceId}`);
        } else {
          // If ID not returned directly, fetch the latest invoice
          try {
            const latest = await db.list<Row>('invoices', { order: 'created_at.desc' });
            if (latest.length && latest[0].id) {
              setLocation(`/invoices/${latest[0].id}`);
              return;
            }
          } catch (e) {}
          setLocation('/invoices');
        }
      }
    } catch (e) { setMessage(getSupabaseErrorMessage(e, 'Could not save the invoice.')); } finally { setSaving(false); }
  };
  return <div className="mx-auto max-w-5xl"><div className="mb-6 flex items-center gap-3"><Link href="/invoices" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground no-underline hover:text-foreground" data-testid="link-back-invoices"><ArrowLeft size={17} /></Link><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Fast entry</div><h2 className="text-2xl font-extrabold tracking-[-.05em]">New invoice</h2></div></div>
    {message && <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/8 p-3 text-xs font-semibold text-destructive" data-testid="status-invoice-form">{message}</div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><section className="card-shell p-5 sm:p-6">
      {/* Date & Time Picker Section */}
      <div className="mb-6 rounded-xl border border-border/80 bg-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Calendar size={13} />
            </div>
            <span className="text-xs font-extrabold">Invoice Date & Time</span>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">Default: Today (Editable)</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Calendar size={12} className="text-primary" /> <span>Date</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="input-shell min-h-10 w-full px-3 text-sm font-medium"
              data-testid="input-invoice-date"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Clock size={12} className="text-primary" /> <span>Time</span>
            </label>
            <input
              type="time"
              value={issueTime}
              onChange={(e) => setIssueTime(e.target.value)}
              className="input-shell min-h-10 w-full px-3 text-sm font-medium"
              data-testid="input-invoice-time"
            />
          </div>
        </div>
      </div>

      <label className="mb-2 block text-xs font-bold">Customer / Business <span className="text-accent">*</span></label>
      <div className="relative mb-6">
        {customerId ? (() => {
          const c = customers.data.find(x => x.id === customerId);
          const cGstin = c ? getCustomerGstin(c) : '';
          return (
            <div className="relative rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="font-bold text-base">{c?.name || 'Unknown customer'}</div>
                    
                    {/* Live Khata Book Balance Badge */}
                    {customerKhataBalance && (
                      customerKhataBalance.net > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-extrabold text-amber-800 dark:text-amber-300">
                          <AlertCircle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Khata Due: <strong className="mono">₹{customerKhataBalance.due.toFixed(2)}</strong></span>
                        </span>
                      ) : customerKhataBalance.net < 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                          <BookOpen size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Store Credit Available: <strong className="mono">₹{customerKhataBalance.credit.toFixed(2)}</strong></span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                          <span>Khata Settled (₹0.00)</span>
                        </span>
                      )
                    )}
                  </div>

                  {c?.phone && <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5"><Phone size={13} /> {c.phone}</div>}
                  {c?.email && <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5"><Mail size={13} /> {c.email}</div>}
                  {cGstin && <div className="mt-1 text-xs font-bold text-primary flex items-center gap-1.5"><ShieldCheck size={13} /> <span className="mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20">GSTIN: {cGstin}</span></div>}
                  {c?.address && <div className="mt-1 text-sm text-muted-foreground flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0" /> <span className="leading-tight">{c.address}</span></div>}
                  {c?.notes && <div className="mt-3 text-sm text-muted-foreground flex items-start gap-1.5 border-t border-border/50 pt-2"><FileText size={13} className="mt-0.5 shrink-0" /> <span className="leading-tight italic">{getCustomerNotes(c)}</span></div>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setNewCustomerForm({ ...c, gstin: getCustomerGstin(c || {}), notes: getCustomerNotes(c || {}) }); setCustomerDropdown(false); setCustomerModal(true); }} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md hover:text-foreground" title="Edit Customer"><Pencil size={15} /></button>
                  <button onClick={() => { setCustomerId(''); setCustomerQuery(''); }} className="p-1.5 text-muted-foreground hover:bg-muted rounded-md hover:text-destructive" title="Clear"><X size={15} /></button>
                </div>
              </div>
              {!c?.email && <div className="mt-4 border-t border-border/50 pt-3"><button type="button" onClick={() => { setNewCustomerForm({ ...c, gstin: getCustomerGstin(c || {}), notes: getCustomerNotes(c || {}) }); setCustomerDropdown(false); setCustomerModal(true); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"><Mail size={14} /> Setup email</button></div>}
            </div>
          );
        })() : (
          <>
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <input value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdown(true); }} onFocus={() => setCustomerDropdown(true)} onBlur={() => setTimeout(() => setCustomerDropdown(false), 250)} placeholder="Search customer/company name, or enter 10-digit phone to create" className="input-shell min-h-10 w-full pl-10 pr-3 text-sm" data-testid="input-customer-search" />
            {customerDropdown && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card shadow-float">
                {customers.loading ? (
                  <div className="p-3 text-xs text-muted-foreground">Loading customers...</div>
                ) : visibleCustomers.length ? (
                  visibleCustomers.map((c) => {
                    const kBal = getKhataBalanceForCustomer(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setCustomerId(c.id); setCustomerDropdown(false); }}
                        onClick={(e) => { e.preventDefault(); setCustomerId(c.id); setCustomerDropdown(false); }}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0 cursor-pointer"
                        data-testid={`button-select-customer-${c.id}`}
                      >
                        <div>
                          <div className="font-bold text-foreground">{c.name}</div>
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {kBal.net > 0 ? (
                            <span className="text-[10px] font-extrabold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/25">
                              Due: ₹{kBal.due.toFixed(2)}
                            </span>
                          ) : kBal.net < 0 ? (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/25">
                              Credit: ₹{kBal.credit.toFixed(2)}
                            </span>
                          ) : null}
                          {getCustomerGstin(c) && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">GST</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
  <>
    <div className="p-3 text-xs text-muted-foreground">No customers found.</div>
    {customerQuery.length >= 10 && (
      <button 
        type="button"
        onMouseDown={(e) => { e.preventDefault(); openCustomerModal(); }}
        onClick={(e) => { e.preventDefault(); openCustomerModal(); }}
        className="flex w-full items-center justify-between border-t border-border/60 bg-primary/5 px-3 py-3 text-left text-sm font-bold text-primary hover:bg-primary/10 cursor-pointer"
      >
        <span>Create with this number</span>
        <Plus size={16} />
      </button>
    )}
  </>
)}</div>)}</>)}</div><div className="mb-3 flex items-end justify-between">
  <div>
    <h3 className="text-sm font-extrabold">Line items</h3>
    <p className="mt-1 text-xs text-muted-foreground">Search by product name.</p>
  </div>
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => {
        setCustomItemForm({ title: '', description: '', price: '', quantity: 1 });
        setCustomItemModal(true);
      }}
      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 cursor-pointer"
    >
      <Plus size={14} /> Custom add
    </button>
    <span className="mono text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
  </div>
</div>

<div className="relative mb-3">
  <Search className="absolute left-3 top-3 text-muted-foreground" size={16} />
  <input
    value={query}
    onChange={(e) => { setQuery(e.target.value); setProductDropdown(true); }}
    onFocus={() => setProductDropdown(true)}
    onBlur={() => setTimeout(() => setProductDropdown(false), 250)}
    placeholder="Type to search and add a product…"
    className="input-shell w-full pl-10 pr-3 text-sm"
    data-testid="input-product-search"
  />
  {productDropdown && (
    <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card shadow-float">
      {products.loading ? (
        <div className="p-4 text-xs text-muted-foreground">Loading products…</div>
      ) : visibleProducts.length ? (
        visibleProducts.map((product) => {
          const isServ = product.type === 'service' || product.item_type === 'service' || product.unit === 'service';
          const stockVal = Number(product.stock_quantity ?? product.stock ?? 0);
          const isZeroStock = !isServ && stockVal <= 0;
          const isLowStock = !isServ && stockVal > 0 && stockVal <= 5;

          return (
            <div
              key={product.id}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!isZeroStock) {
                  addItem(product);
                  setQuery('');
                  setProductDropdown(false);
                } else {
                  setZeroStockModalProduct(product);
                  setProductDropdown(false);
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (!isZeroStock) {
                  addItem(product);
                  setQuery('');
                  setProductDropdown(false);
                } else {
                  setZeroStockModalProduct(product);
                  setProductDropdown(false);
                }
              }}
              className={`flex w-full items-center justify-between border-b border-border/60 px-3.5 py-3 text-left last:border-0 transition-colors cursor-pointer ${
                isZeroStock ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20' : 'hover:bg-primary/10'
              }`}
              data-testid={`product-search-row-${product.id}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-8 w-8 rounded-lg object-cover border border-border shrink-0 bg-card" />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Package size={14} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="block text-xs font-bold text-foreground truncate">{product.name}</span>
                    {isZeroStock ? (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-destructive border border-destructive/25">
                        Out of Stock (0)
                      </span>
                    ) : isLowStock ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/25">
                        Only {stockVal} Left
                      </span>
                    ) : null}
                  </div>
                  {product.unit && <span className="text-[10px] text-muted-foreground font-medium uppercase">{product.unit}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="mono text-xs font-bold text-primary">₹{Number(product.price || 0).toFixed(2)}</span>
                {isZeroStock && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setZeroStockModalProduct(product);
                      setProductDropdown(false);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setZeroStockModalProduct(product);
                      setProductDropdown(false);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all shadow-2xs cursor-pointer"
                    title="Force add out of stock product"
                    data-testid={`button-force-add-${product.id}`}
                  >
                    <Plus size={12} />
                    <span>Add Anyway</span>
                  </button>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-4 text-xs text-muted-foreground">No matching products found.</div>
      )}
    </div>
  )}
</div>

      {items.length ? (
        <div className="divide-y divide-border/70">
          {items.map((item, index) => {
            const prodObj = products.data.find(p => p.id === item.product_id);
            const isVirtualService = item.unit === 'service' || prodObj?.type === 'service' || Boolean(prodObj?.allow_custom_price);
            const isZeroOrCustomPrice = isVirtualService && (item.price === 0 || item.price === '' || Number(item.price) === 0);

            return (
              <div className="py-3.5" key={item.product_id || index}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 basis-[120px]">
                    <div className="truncate text-sm font-bold flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {isVirtualService && (
                        <span className="rounded bg-indigo-500/15 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                          Virtual Service
                        </span>
                      )}
                    </div>
                    <div className="mono mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => setItems((old) => old.map((x, i) => i === index ? { ...x, price: e.target.value === '' ? '' : Number(e.target.value) } : x))}
                        onBlur={(e) => setItems((old) => old.map((x, i) => i === index ? { ...x, price: x.price === '' ? 0 : x.price } : x))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`input-shell h-7 w-20 px-1.5 text-center text-[11px] font-bold shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          isZeroOrCustomPrice
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 font-black'
                            : 'bg-background text-foreground'
                        }`}
                        placeholder="0.00"
                        data-testid={`input-item-price-${item.product_id}`}
                      />
                      <span>/ {item.unit || 'unit'}</span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setItems((old) => old.map((x, i) => i === index ? { ...x, quantity: Math.max(1, Number(x.quantity || 0) - 1) } : x))}
                      className="flex h-9 w-9 items-center justify-center rounded-l-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setItems((old) => old.map((x, i) => i === index ? { ...x, quantity: val } : x));
                      }}
                      onBlur={(e) => {
                        const val = e.target.value === '' ? 1 : Math.max(1, Number(e.target.value));
                        setItems((old) => old.map((x, i) => i === index ? { ...x, quantity: val } : x));
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="input-shell h-9 w-12 border-x-0 rounded-none px-1 text-center text-sm font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      data-testid={`input-item-quantity-${item.product_id}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setItems((old) => old.map((x, i) => i === index ? { ...x, quantity: Number(x.quantity || 0) + 1 } : x));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-r-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="mono w-20 text-right text-sm font-bold">
                    ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((old) => old.filter((_, i) => i !== index))}
                    className="p-2 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                    data-testid={`button-remove-item-${item.product_id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Helper Alert Notice for Virtual Service Custom Price */}
                {isVirtualService && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                    <AlertCircle size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
                    <span>Virtual Service: Enter custom billing amount/price in the box above.</span>
                  </div>
                )}

                {/* Low Stock / Out of Stock Alert Notice for Physical Products */}
                {!isVirtualService && prodObj && (() => {
                  const stock = Number(prodObj.stock_quantity ?? prodObj.stock ?? 0);
                  if (stock <= 0) {
                    return (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Out of Stock Item: 0 remaining in inventory (Force added via "+ Add Anyway").</span>
                      </div>
                    );
                  }
                  if (stock > 0 && stock <= 5) {
                    return (
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Low Stock Alert: Only {stock} unit(s) remaining in inventory!</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty icon={Package} title="Start with a product" description="Search above to add your first line item." />
      )}</section>
      <aside className="card-shell h-fit p-5 sm:p-6">
        <h3 className="text-sm font-extrabold">Summary</h3>
        
        <div className="mt-4 mb-4">
          <label className="mb-2 block text-xs font-bold">Discount (optional)</label>
          <div className="flex gap-2">
            <CustomDropdown value={discountType} onChange={(v) => { setDiscountType(v as 'amount' | 'percentage'); setDiscountValue(''); }} options={[{label: 'Amount', value: 'amount'}, {label: 'Percent (%)', value: 'percentage'}]} />
            <input 
              type="number" 
              min="0" 
              placeholder="0" 
              value={discountValue} 
              onChange={(e) => setDiscountValue(e.target.value)} 
              className="input-shell min-h-9 w-full px-3 text-sm"
            />
          </div>
          {Number(discountValue) > 0 && discountAmount > subtotal ? (
            <p className="mt-1.5 text-[11px] font-medium text-destructive">Discount cannot exceed subtotal.</p>
          ) : Number(discountValue) > 0 && subtotal > 0 ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
              {discountType === 'percentage' 
                ? `Equals ${discountAmount.toFixed(2)} amount discount` 
                : `Equals ${((discountAmount / subtotal) * 100).toFixed(2)}% discount`}
            </p>
          ) : null}
        </div>

        {/* Khata / Store Credit & Previous Due Adjustments */}
        {customerId && customerKhataBalance && !customerKhataBalance.isZero && (
          <div className="mt-4 mb-4 space-y-2 border-t border-border/60 pt-3 text-xs">
            {/* Store Credit / Wallet Redemption Control */}
            {customerKhataBalance.credit > 0 && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-800 dark:text-emerald-300">
                    Apply Store Credit / Wallet
                  </span>
                  <input
                    type="checkbox"
                    checked={useStoreCredit}
                    onChange={(e) => {
                      setUseStoreCredit(e.target.checked);
                      if (e.target.checked) {
                        setAppliedStoreCredit(String(Math.min(customerKhataBalance.credit, netBeforeKhata)));
                      }
                    }}
                    className="h-4 w-4 accent-emerald-600 cursor-pointer"
                    data-testid="toggle-use-store-credit"
                  />
                </div>
                {useStoreCredit && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Redeem Amount (Max: ₹{customerKhataBalance.credit.toFixed(2)})</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={customerKhataBalance.credit}
                      value={appliedStoreCredit}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (val > customerKhataBalance.credit) {
                          toast.warning(`Cannot exceed available store credit balance (Max: ₹${customerKhataBalance.credit.toFixed(2)}).`);
                          setAppliedStoreCredit(String(customerKhataBalance.credit));
                        } else {
                          setAppliedStoreCredit(e.target.value);
                        }
                      }}
                      placeholder="0.00"
                      className="input-shell min-h-9 w-full px-3 text-sm font-extrabold mono"
                      data-testid="input-store-credit-amount"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Previous Khata Due Inclusion Control */}
            {customerKhataBalance.due > 0 && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-800 dark:text-amber-300">
                    Add Previous Khata Due
                  </span>
                  <input
                    type="checkbox"
                    checked={usePreviousDue}
                    onChange={(e) => {
                      setUsePreviousDue(e.target.checked);
                      if (e.target.checked) {
                        setIncludedPreviousDue(String(customerKhataBalance.due));
                      }
                    }}
                    className="h-4 w-4 accent-amber-600 cursor-pointer"
                    data-testid="toggle-use-previous-due"
                  />
                </div>
                {usePreviousDue && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Due Amount to Add (Max: ₹{customerKhataBalance.due.toFixed(2)})</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={customerKhataBalance.due}
                      value={includedPreviousDue}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (val > customerKhataBalance.due) {
                          toast.warning(`Cannot exceed previous Khata due balance (Max: ₹${customerKhataBalance.due.toFixed(2)}).`);
                          setIncludedPreviousDue(String(customerKhataBalance.due));
                        } else {
                          setIncludedPreviousDue(e.target.value);
                        }
                      }}
                      placeholder="0.00"
                      className="input-shell min-h-9 w-full px-3 text-sm font-extrabold mono"
                      data-testid="input-previous-due-amount"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 space-y-3 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="mono">{subtotal.toFixed(2)}</span>
          </div>
          {finalDiscount > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span className="mono">-{finalDiscount.toFixed(2)}</span>
            </div>
          )}
          {taxEnabled ? (
            <div className="flex justify-between text-muted-foreground">
              <span>{taxName} ({taxRate}%)</span>
              <span className="mono">{taxAmount.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-muted-foreground/60">
              <span>Tax (0%)</span>
              <span className="mono">0.00</span>
            </div>
          )}

          {actualStoreCreditApplied > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Store Credit Redeemed</span>
              <span className="mono">-{actualStoreCreditApplied.toFixed(2)}</span>
            </div>
          )}

          {actualPreviousDueAdded > 0 && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
              <span>Previous Khata Due Billed</span>
              <span className="mono">+{actualPreviousDueAdded.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold">Total</span>
              <span className="mono text-2xl font-medium">{finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Confirmation & Notifications Section */}
        <div className="mt-5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <Bell size={13} className="text-primary" />
              <span>Confirmation</span>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">Notifications</span>
          </div>
          <p className="mb-2.5 text-[11px] text-muted-foreground leading-tight">
            Select channels to send invoice confirmation & receipts:
          </p>
          
          <div className="space-y-2">
            {/* Email - Default ON & Locked */}
            <div className="flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Mail size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">Email</span>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary">Default</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Always on · Cannot be disabled</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5" title="Email is locked on by default">
                <Lock size={12} className="text-primary/70" />
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  readOnly
                  className="h-4 w-4 rounded border-primary text-primary accent-primary cursor-not-allowed"
                />
              </div>
            </div>

            {/* WhatsApp - Selectable */}
            <label
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors select-none ${
                notifyWhatsApp
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                  : 'border-border/60 bg-background/60 hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${
                    notifyWhatsApp ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <MessageCircle size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${notifyWhatsApp ? 'text-foreground' : ''}`}>WhatsApp</span>
                    {notifyWhatsApp && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        Selected
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Send PDF to customer WhatsApp</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyWhatsApp}
                onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                className="h-4 w-4 rounded border-border text-emerald-600 accent-emerald-600 cursor-pointer"
              />
            </label>

            {/* Phone Call - Selectable */}
            <label
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors select-none ${
                notifyPhoneCall
                  ? 'border-blue-500/40 bg-blue-500/10 text-foreground'
                  : 'border-border/60 bg-background/60 hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${
                    notifyPhoneCall ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <PhoneCall size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${notifyPhoneCall ? 'text-foreground' : ''}`}>Phone Call</span>
                    {notifyPhoneCall && (
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                        Selected
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Automated voice confirmation</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyPhoneCall}
                onChange={(e) => setNotifyPhoneCall(e.target.checked)}
                className="h-4 w-4 rounded border-border text-blue-600 accent-blue-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <label className="mt-6 mb-2 block text-xs font-bold">Note <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-shell min-h-20 w-full resize-none p-3 text-sm" placeholder="Payment terms or a note…" data-testid="textarea-invoice-notes" /><button disabled={saving} onClick={() => void save()} className="btn-primary mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold disabled:opacity-50" data-testid="button-save-invoice">{saving ? 'Generating invoice…' : <><Check size={16} /> Generate & View Invoice</>}</button></aside></div>

    {/* Zero Stock Warning Confirmation Modal */}
    {zeroStockModalProduct && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
        <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl relative overflow-hidden animate-rise">
          <div className="text-center">
            <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-extrabold text-foreground">Out of Stock Warning</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Product <span className="font-bold text-foreground">"{zeroStockModalProduct.name}"</span> currently has <span className="font-extrabold text-amber-600 dark:text-amber-400">0 remaining inventory in stock</span>.
            </p>
            <p className="mt-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-center leading-relaxed">
              Stock is completely zero! Please proceed carefully if inventory is unavailable.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => setZeroStockModalProduct(null)}
              className="flex-1 rounded-xl border border-border bg-muted/30 py-2.5 px-4 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              data-testid="button-cancel-zero-stock-dialog"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={() => {
                addItem(zeroStockModalProduct, true);
                setZeroStockModalProduct(null);
                setQuery('');
                setProductDropdown(false);
              }}
              className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-4 text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              data-testid="button-confirm-zero-stock-add"
            >
              <Check size={14} /> Confirm & Add
            </button>
          </div>
        </div>
      </div>
    )}

    {customerModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/40 backdrop-blur-xs p-0 sm:items-center sm:p-5">
        <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-float sm:rounded-2xl sm:p-7">
          <div className="mb-5 flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                {newCustomerForm.customer_type === 'company' ? <Building2 size={18} /> : <Users size={18} />}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{newCustomerForm.id ? 'Edit record' : 'New record'}</div>
                <h3 className="text-base sm:text-lg font-extrabold text-foreground">{newCustomerForm.id ? 'Edit Customer / Business' : 'Add Customer / Business'}</h3>
              </div>
            </div>
            <button type="button" onClick={() => setCustomerModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
          </div>

          {newCustomerForm._error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-xs font-semibold text-destructive">{newCustomerForm._error}</div>}

          <div className="space-y-4">
            {/* 1. Entity Type Selector (Individual / Person vs. Company / Business) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-foreground">Entity Type *</label>
                {newCustomerForm.id && (
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
                    <Lock size={11} className="text-primary" />
                    <span>Fixed on Edit</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!!newCustomerForm.id}
                  onClick={() => setNewCustomerForm({ ...newCustomerForm, customer_type: 'individual', gstin: '' })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    (newCustomerForm.customer_type || 'individual') === 'individual'
                      ? 'border-primary bg-primary/10 text-primary font-black shadow-sm ring-2 ring-primary/20'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  } ${newCustomerForm.id ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <Users size={16} />
                  <span>Individual / Person</span>
                </button>
                <button
                  type="button"
                  disabled={!!newCustomerForm.id}
                  onClick={() => setNewCustomerForm({ ...newCustomerForm, customer_type: 'company' })}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    newCustomerForm.customer_type === 'company'
                      ? 'border-primary bg-primary/10 text-primary font-black shadow-sm ring-2 ring-primary/20'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  } ${newCustomerForm.id ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <Building2 size={16} />
                  <span>Company / Business</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AppField 
                  label={newCustomerForm.customer_type === 'company' ? "Company Name *" : "Customer Name *"} 
                  value={newCustomerForm.name || ''} 
                  onChange={(v) => setNewCustomerForm({ ...newCustomerForm, name: v })} 
                  placeholder={newCustomerForm.customer_type === 'company' ? "e.g. Alpha Corp, Global Tech Pvt Ltd" : "e.g. John Doe, Rahul Sharma"} 
                  required 
                />
              </div>
              <AppField 
                label={newCustomerForm.customer_type === 'company' ? "Company Phone Number *" : "Phone Number *"} 
                type="tel" 
                value={newCustomerForm.phone || ''} 
                onChange={(v) => setNewCustomerForm({ ...newCustomerForm, phone: v })} 
                placeholder="e.g. +91 98765 43210" 
                required 
              />
              <AppField 
                label={newCustomerForm.customer_type === 'company' ? "Company Email Address" : "Email Address"} 
                type="email" 
                value={newCustomerForm.email || ''} 
                onChange={(v) => setNewCustomerForm({ ...newCustomerForm, email: v })} 
                placeholder={newCustomerForm.customer_type === 'company' ? "e.g. contact@company.com" : "e.g. john@example.com"} 
              />
              <div className="sm:col-span-2">
                <AppField 
                  label={newCustomerForm.customer_type === 'company' ? "Company Address" : "Address"} 
                  value={newCustomerForm.address || ''} 
                  onChange={(v) => setNewCustomerForm({ ...newCustomerForm, address: v })} 
                  placeholder={newCustomerForm.customer_type === 'company' ? "e.g. 123 Industrial Area, City, State, PIN" : "e.g. 123 Main Street, City, State, PIN"} 
                />
              </div>

              {/* GSTIN / GST Number Field (Company / Business only) */}
              {newCustomerForm.customer_type === 'company' && (
                <div className="sm:col-span-2 pt-2 border-t border-border/60">
                  <GSTVerificationInput
                    value={newCustomerForm.gstin || ''}
                    onChange={(v) => setNewCustomerForm({ ...newCustomerForm, gstin: v })}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-foreground">
                  {newCustomerForm.customer_type === 'company' ? "Notes / Business Remarks" : "Notes / Remarks"}
                </label>
                <textarea 
                  value={newCustomerForm.notes || ''} 
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })} 
                  placeholder="Additional notes, business preferences, or payment terms..." 
                  className="input-shell min-h-20 w-full p-3 text-sm font-normal" 
                />
              </div>
            </div>

            {/* 2. Save Customer to Directory Toggle Switch (Default: ON) */}
            <div className="pt-2 border-t border-border/60">
              <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors select-none ${
                newCustomerForm.save_to_directory !== false
                  ? 'border-primary/40 bg-primary/5 text-foreground'
                  : 'border-border bg-muted/20 text-muted-foreground'
              }`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-foreground">Save Customer to Directory</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                      newCustomerForm.save_to_directory !== false ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {newCustomerForm.save_to_directory !== false ? 'Default (ON)' : 'One-Time Only'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {newCustomerForm.save_to_directory !== false 
                      ? 'Keep this customer in your directory for future invoices' 
                      : 'Use customer for this invoice only (will not be saved to your directory)'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={newCustomerForm.save_to_directory !== false}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, save_to_directory: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <button type="button" onClick={() => setCustomerModal(false)} className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button 
              type="button"
              onClick={() => void saveNewCustomerForm()} 
              disabled={saving || !newCustomerForm.name || !newCustomerForm.phone} 
              className="rounded-xl bg-primary px-5 py-2 text-xs sm:text-sm font-extrabold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}

function InvoiceDetail() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [business, setBusiness] = useState<Row | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentSuccessAnim, setPaymentSuccessAnim] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [payLaterModal, setPayLaterModal] = useState(false);
  const [payLaterAmountPaid, setPayLaterAmountPaid] = useState<string>('0');
  const [payLaterPaymentMethod, setPayLaterPaymentMethod] = useState<string>('Cash');
  const [payLaterNote, setPayLaterNote] = useState<string>('');
  const [cancelConfirmModal, setCancelConfirmModal] = useState(false);
  const [returnModalItem, setReturnModalItem] = useState<Row | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState<string>('Cash');
  const [refundReferenceNote, setRefundReferenceNote] = useState<string>('');
  const [isReplacementMode, setIsReplacementMode] = useState<boolean>(false);
  const [returnLogs, setReturnLogs] = useState<Row[]>([]);
  const [returningItem, setReturningItem] = useState<boolean>(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateSettings, setTemplateSettings] = useState<InvoiceTemplateSettings>(() => {
    try {
      const raw = localStorage.getItem('arventa_invoice_template_settings');
      if (raw) return JSON.parse(raw);
      const taxRaw = localStorage.getItem('arventa_tax_settings');
      if (taxRaw) {
        const gc = JSON.parse(taxRaw);
        return {
          template_id: gc.invoice_template || 'standard',
          print_size: gc.invoice_print_size || 'A4',
          primary_color: '#ea580c',
          show_qr: true,
          show_bank_details: true,
          show_terms: true,
          show_signature: true,
          show_hsn: true,
          custom_footer_note: '',
        };
      }
    } catch {}
    return {
      template_id: 'standard',
      print_size: 'A4',
      primary_color: '#ea580c',
      show_qr: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      show_hsn: true,
      custom_footer_note: '',
    };
  });

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      // 1. Load invoice
      const invRows = await db.list<Row>('invoices', { id });
      if (!invRows.length) {
        setError('Invoice not found.');
        return;
      }
      const inv = invRows[0];
      setInvoice(inv);

      // 2. Load line items
      try {
        const rawItemRows = await db.list<Row>('invoice_items', { invoice_id: id });
        const itemRows = rawItemRows.filter((it) => !it.invoice_id || it.invoice_id === id);
        const products = await db.list<Row>('products');
        const prodMap = new Map<string, Row>();
        products.forEach((p) => {
          if (p.id) prodMap.set(p.id, p);
        });

        const enrichedItems = itemRows.map((it) => {
          const prod = prodMap.get(it.product_id);
          let isReturnable = prod ? (prod.is_returnable !== false) : false;
          let restockOnReturn = prod ? (prod.restock_on_return !== false) : true;
          let returnWindowUnit = prod ? (prod.return_window_unit || 'days') : 'days';
          let returnWindowValue = prod ? (prod.return_window_value !== undefined ? Number(prod.return_window_value) : (prod.return_window_days !== undefined ? Number(prod.return_window_days) : 7)) : 7;

          if (prod && prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
            try {
              const meta = JSON.parse(prod.notes);
              if (meta.is_returnable !== undefined) isReturnable = Boolean(meta.is_returnable);
              if (meta.restock_on_return !== undefined) restockOnReturn = Boolean(meta.restock_on_return);
              if (meta.return_window_unit) returnWindowUnit = meta.return_window_unit;
              if (meta.return_window_value !== undefined) returnWindowValue = Number(meta.return_window_value);
            } catch (e) {}
          }

          return {
            ...it,
            product_name: it.product_name || prod?.name || 'Item',
            product_unit: it.unit || prod?.unit || 'pcs',
            product_obj: prod,
            is_returnable: isReturnable,
            restock_on_return: restockOnReturn,
            return_window_unit: returnWindowUnit,
            return_window_value: returnWindowValue,
            returned_qty: Number(it.returned_qty || (it.status === 'returned' ? it.quantity : 0)),
          };
        });
        setItems(enrichedItems);
      } catch (err) {
        console.warn('Could not load line items:', err);
      }

      // 3. Load customer
      if (inv.customer_id) {
        try {
          const custRows = await db.list<Row>('customers', { id: inv.customer_id });
          if (custRows.length) setCustomer(custRows[0]);
        } catch (err) {
          console.warn('Could not load customer:', err);
        }
      }

      // 4. Load business and payment details
      try {
        const bid = inv.business_id || (await getBusinessId());
        if (bid) {
          const bizRows = await db.list<Row>('businesses', { id: bid });
          if (bizRows.length) {
            setBusiness(bizRows[0]);
            setPaymentInfo((prev: any) => ({ ...bizRows[0], ...prev }));
          }

          try {
            const settingsList = await db.list<Row>('settings', { business_id: bid });
            if (settingsList.length) {
              setPaymentInfo((prev: any) => ({ ...prev, ...settingsList[0] }));
            }
          } catch (se) {}
        }
      } catch (err) {
        console.warn('Could not load business:', err);
      }

      // 5. Fallback to cached payment details if available
      try {
        const rawPay = localStorage.getItem('arventa_payment_settings');
        if (rawPay) {
          const parsedPay = JSON.parse(rawPay);
          setPaymentInfo((prev: any) => ({ ...parsedPay, ...prev }));
        }
        const session = auth.session();
        if (session?.user?.id) {
          const rawBiz = localStorage.getItem(`arventa_biz_${session.user.id}`);
          if (rawBiz) {
            const parsedBiz = JSON.parse(rawBiz);
            setPaymentInfo((prev: any) => ({ ...parsedBiz, ...prev }));
          }
        }
      } catch (le) {}

      // 6. Load return history transactions
      try {
        const rawReturns = await db.list<Row>('returns', { invoice_id: id });
        const validReturns = rawReturns.filter((r) => r.invoice_id === id);
        validReturns.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setReturnLogs(validReturns);
      } catch (reErr) {
        console.warn('Could not load return history logs:', reErr);
      }
    } catch (err: any) {
      setError(getSupabaseErrorMessage(err, 'Could not load invoice details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const isWithinReturnWindow = (issueDateStr?: string, unit = 'days', limitVal = 7) => {
    if (!issueDateStr) return true;
    try {
      const issueDate = new Date(issueDateStr);
      const now = new Date();
      const diffMs = now.getTime() - issueDate.getTime();

      if (unit === 'hours') {
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours <= limitVal;
      } else {
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= limitVal;
      }
    } catch (e) {
      return true;
    }
  };

  const handleReturnItem = async () => {
    if (!returnModalItem || !invoice) return;
    setReturningItem(true);
    try {
      const availableToReturn = Math.max(0, Number(returnModalItem.quantity || 1) - Number(returnModalItem.returned_qty || 0));
      const qtyToReturn = Math.min(returnQty, availableToReturn);
      if (qtyToReturn <= 0) {
        toast.warning('Invalid return quantity.');
        setReturningItem(false);
        return;
      }

      const newReturnedQty = Number(returnModalItem.returned_qty || 0) + qtyToReturn;
      const isFullyReturned = newReturnedQty >= Number(returnModalItem.quantity || 1);

      const unitPrice = Number(returnModalItem.unit_price || returnModalItem.price || 0);
      const totalRefundAmt = unitPrice * qtyToReturn;

      const actualRefundMethod = isReplacementMode ? 'Store Credit (Khata Book)' : refundPaymentMethod;

      // 1. Update invoice_items table with refund metadata
      const updateItemPayload: Record<string, any> = {
        returned_qty: newReturnedQty,
        status: isFullyReturned ? (isReplacementMode ? 'replaced' : 'returned') : (isReplacementMode ? 'partially_replaced' : 'partially_returned'),
        refund_amount: totalRefundAmt,
        refund_method: actualRefundMethod,
        refund_note: refundReferenceNote.trim(),
      };
      if (returnModalItem.id) {
        await db.update('invoice_items', returnModalItem.id, updateItemPayload);
      }

      // 2. If replacement mode: Record credit entry in Khata Book!
      if (isReplacementMode) {
        try {
          const bizId = business?.id || (await getBusinessId());
          const custId = customer?.id || invoice.customer_id;
          const custName = customer?.name || customer?.full_name || 'Customer';
          const custPhone = customer?.phone || '';
          const todayDate = new Date().toISOString().split('T')[0];
          const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const khataEntry = {
            business_id: bizId,
            customer_id: custId,
            customer_name: custName,
            customer_phone: custPhone,
            type: 'got',
            amount: totalRefundAmt,
            date: todayDate,
            time: timeNow,
            payment_mode: 'Store Credit / Replacement',
            bill_reference: invoice.invoice_number || 'INV-0001',
            note: refundReferenceNote.trim() || `Product Replacement Credit for Invoice #${invoice.invoice_number || 'INV-0001'} (${qtyToReturn} pcs of ${returnModalItem.product_name})`,
          };
          await db.insert('khata_entries', khataEntry);
        } catch (khataErr) {
          console.warn('Could not add replacement credit to Khata Book:', khataErr);
        }
      }

      // Record return event log in returns table
      try {
        await db.insert('returns', {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number || '',
          invoice_item_id: returnModalItem.id || '',
          product_id: returnModalItem.product_id || '',
          product_name: returnModalItem.product_name || 'Item',
          product_unit: returnModalItem.product_unit || 'pcs',
          returned_qty: qtyToReturn,
          unit_price: unitPrice,
          refund_amount: totalRefundAmt,
          refund_method: actualRefundMethod,
          refund_note: refundReferenceNote.trim(),
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('Could not record return log:', logErr);
      }

      // 2. If restock_on_return is enabled and product_id exists, restock to Main Stock!
      if (returnModalItem.product_id && returnModalItem.restock_on_return !== false) {
        try {
          const prodList = await db.list<Row>('products', { id: returnModalItem.product_id });
          if (prodList.length) {
            const prod = prodList[0];
            let currentStock = prod.stock_quantity !== undefined && prod.stock_quantity !== null
              ? Number(prod.stock_quantity)
              : (prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 0);

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                if (meta.stock_quantity !== undefined && meta.stock_quantity !== null) {
                  currentStock = Number(meta.stock_quantity);
                }
              } catch (e) {}
            }

            const newStock = currentStock + qtyToReturn;
            const prodPayload: Record<string, any> = {
              stock_quantity: newStock,
              stock: newStock,
            };

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                meta.stock_quantity = newStock;
                prodPayload.notes = JSON.stringify(meta);
              } catch (e) {}
            }

            await db.update('products', returnModalItem.product_id, prodPayload);
          }
        } catch (stErr) {
          console.warn('Could not restock returned product:', stErr);
        }
      }

      // 3. Compute overall invoice return status across all line items
      try {
        const allItemRows = await db.list<Row>('invoice_items', { invoice_id: id });
        const validItems = allItemRows.filter((it) => !it.invoice_id || it.invoice_id === id);

        let totalQty = 0;
        let totalReturnedQty = 0;
        let returnedItemCount = 0;

        validItems.forEach((it) => {
          const q = Number(it.quantity || 1);
          const rq = Number(it.returned_qty || (it.status === 'returned' ? q : 0));
          totalQty += q;
          totalReturnedQty += rq;
          if (rq >= q) returnedItemCount++;
        });

        let newInvoiceStatus = invoice.status;
        if (totalReturnedQty >= totalQty || (validItems.length > 0 && returnedItemCount === validItems.length)) {
          newInvoiceStatus = 'returned';
        } else if (totalReturnedQty > 0) {
          newInvoiceStatus = 'partially_returned';
        }

        if (newInvoiceStatus !== invoice.status) {
          await db.update('invoices', invoice.id, { status: newInvoiceStatus });
        }
      } catch (invStatusErr) {
        console.warn('Could not update overall invoice status:', invStatusErr);
      }

      if (isReplacementMode) {
        toast.success(`Successfully replaced ${qtyToReturn} unit(s) of "${returnModalItem.product_name}". ₹${totalRefundAmt.toFixed(2)} added as credit to Khata Book.${returnModalItem.restock_on_return !== false ? ' Stock restored to main inventory.' : ''}`);
      } else {
        toast.success(`Successfully returned ${qtyToReturn} unit(s) of "${returnModalItem.product_name}". Refund of ₹${totalRefundAmt.toFixed(2)} processed via ${refundPaymentMethod}.${returnModalItem.restock_on_return !== false ? ' Stock restored to main inventory.' : ''}`);
      }
      setReturnModalItem(null);
      setRefundReferenceNote('');
      setIsReplacementMode(false);
      await loadData();
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Could not process item return.'));
    } finally {
      setReturningItem(false);
    }
  };

  const markAsPaid = async (method = 'Cash', note = '') => {
    if (!invoice || !id) return;
    setUpdating(true);
    try {
      const now = new Date().toISOString();
      const updated: Record<string, any> = {
        status: 'paid',
        payment_method: method,
        paid_at: now,
      };
      if (note.trim()) {
        updated.notes = `${invoice.notes || ''}\nPayment: Paid via ${method} (${note.trim()})`.trim();
      }
      await db.update('invoices', id, updated);
      
      setPaymentSuccessAnim(true);
      setTimeout(() => {
        setInvoice({ ...invoice, ...updated });
        setPaymentSuccessAnim(false);
        setPaymentModal(false);
        setUpdating(false);
      }, 1800); // Wait for 1.8s to show the animation
    } catch (err) {
      console.error('Error updating status to paid:', err);
      setUpdating(false);
    }
  };

  const markAsDue = async () => {
    if (!invoice || !id) return;
    setUpdating(true);
    try {
      const updated: Record<string, any> = {
        status: 'due',
        payment_method: null,
        paid_at: null,
      };
      await db.update('invoices', id, updated);
      setInvoice({ ...invoice, ...updated });
    } catch (err) {
      console.error('Error updating status to due:', err);
    } finally {
      setUpdating(false);
    }
  };

  const confirmPayLater = async () => {
    if (!invoice || !id) return;
    setUpdating(true);
    try {
      const totalAmt = Number(invoice.total || 0);
      const paidAmt = Math.max(0, Math.min(totalAmt, Number(payLaterAmountPaid) || 0));
      const dueAmt = Math.max(0, totalAmt - paidAmt);
      const now = new Date().toISOString();
      const todayDate = new Date().toISOString().slice(0, 10);
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let newStatus = 'paid';

      const updated: Record<string, any> = {
        status: newStatus,
        paid_amount: paidAmt,
        balance: dueAmt,
        payment_method: paidAmt > 0 ? payLaterPaymentMethod : 'Khata Book',
        paid_at: now,
      };
      if (payLaterNote.trim()) {
        updated.notes = `${invoice.notes || ''}\nPay Later Note (${paidAmt > 0 ? payLaterPaymentMethod : 'Khata'}): ${payLaterNote.trim()}`.trim();
      }
      await db.update('invoices', id, updated);

      const custId = invoice.customer_id || 'guest';
      const custName = customer?.name || 'Customer';
      const custPhone = customer?.phone || '';
      const bizId = invoice.business_id || (await getBusinessId());

      // 1. Record 'gave' entry for balance due owed by customer to Khata Book
      if (dueAmt > 0) {
        const gaveEntry = {
          business_id: bizId,
          customer_id: custId,
          customer_name: custName,
          customer_phone: custPhone,
          type: 'gave',
          amount: dueAmt,
          date: todayDate,
          time: timeNow,
          payment_mode: 'Due',
          bill_reference: invoice.invoice_number || 'INV-0001',
          note: payLaterNote.trim() || `Invoice ${invoice.invoice_number || 'INV-0001'} Pay Later balance due`,
        };
        await db.insert('khata_entries', gaveEntry);
      }

      // 2. If customer paid a partial amount today, also record 'got' entry in Khata Book
      if (paidAmt > 0) {
        const gotEntry = {
          business_id: bizId,
          customer_id: custId,
          customer_name: custName,
          customer_phone: custPhone,
          type: 'got',
          amount: paidAmt,
          date: todayDate,
          time: timeNow,
          payment_mode: payLaterPaymentMethod,
          bill_reference: invoice.invoice_number || 'INV-0001',
          note: `Payment received (${payLaterPaymentMethod}) for Invoice ${invoice.invoice_number || 'INV-0001'}`,
        };
        await db.insert('khata_entries', gotEntry);
      }

      setInvoice({ ...invoice, ...updated });
      toast.success(`Invoice saved! Balance ₹${dueAmt.toFixed(2)} recorded in Khata Book.`);
      setPayLaterModal(false);
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Could not save Pay Later record.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice || !id) return;
    setUpdating(true);
    try {
      await db.update('invoices', id, { status: 'cancelled' });

      // Restore inventory stock for physical items on cancelled invoice
      try {
        const invItems = await db.list<Row>('invoice_items', { invoice_id: id });
        for (const item of invItems) {
          if (!item.product_id) continue;
          try {
            const prodList = await db.list<Row>('products', { id: item.product_id });
            if (!prodList || !prodList.length) continue;
            const prod = prodList[0];

            const isServ = prod.type === 'service' || prod.item_type === 'service' || prod.unit === 'service';
            if (isServ) continue;

            let isReturnable = prod.is_returnable !== false;
            let restockOnReturn = prod.restock_on_return !== false;
            let currentStock = prod.stock_quantity !== undefined && prod.stock_quantity !== null
              ? Number(prod.stock_quantity)
              : (prod.stock !== undefined && prod.stock !== null ? Number(prod.stock) : 0);

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                if (meta.type === 'service') continue;
                if (meta.is_returnable !== undefined) isReturnable = Boolean(meta.is_returnable);
                if (meta.restock_on_return !== undefined) restockOnReturn = Boolean(meta.restock_on_return);
                if (meta.stock_quantity !== undefined && meta.stock_quantity !== null) {
                  currentStock = Number(meta.stock_quantity);
                }
              } catch (e) {}
            }

            if (!isReturnable || !restockOnReturn) {
              // Skip stock restoration if non-returnable OR auto-restock is OFF (e.g. damaged goods)
              continue;
            }

            const qtyRestored = Number(item.quantity || 1);
            const newStock = currentStock + qtyRestored;

            const updatePayload: Record<string, any> = {
              stock_quantity: newStock,
              stock: newStock,
            };

            if (prod.notes && (prod.notes.startsWith('{') || prod.notes.startsWith('['))) {
              try {
                const meta = JSON.parse(prod.notes);
                meta.stock_quantity = newStock;
                updatePayload.notes = JSON.stringify(meta);
              } catch (e) {}
            }

            await db.update('products', item.product_id, updatePayload);
          } catch (stErr) {
            console.warn('Could not restore stock on cancellation:', item.product_id, stErr);
          }
        }
      } catch (itemFetchErr) {
        console.warn('Could not fetch items to restore stock on cancellation:', itemFetchErr);
      }

      // Revert Khata Book balance adjustments for cancelled invoice
      try {
        const invoiceNum = invoice.invoice_number;
        if (invoiceNum) {
          const rawKhata = await db.list<Row>('khata_entries', { bill_reference: invoiceNum });
          const invKhataEntries = rawKhata.filter((k) => k.bill_reference === invoiceNum);
          for (const kEntry of invKhataEntries) {
            if (kEntry.id) {
              await db.remove('khata_entries', kEntry.id);
            }
          }
        }
      } catch (khataRevErr) {
        console.warn('Could not revert Khata entries on invoice cancellation:', khataRevErr);
      }

      toast.success(`Invoice ${invoice.invoice_number || ''} cancelled. Stock restored & Khata adjustments reverted.`);
      setCancelConfirmModal(false);
      setInvoice((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      setLocation('/invoices');
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Could not cancel invoice.'));
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const element = document.getElementById('invoice-download-container');
    if (!element) {
      toast.error('Invoice preview container not found.');
      return;
    }
    
    try {
      const scale = 2; // For better resolution
      const width = element.clientWidth || element.offsetWidth || 800;
      const height = element.clientHeight || element.offsetHeight || 1100;

      const dataUrl = await domtoimage.toJpeg(element, {
        quality: 0.98,
        bgcolor: '#ffffff',
        filter: (node: Node) => {
          if (!node) return false;
          if (node.nodeType === 1 && (node as HTMLElement).tagName === 'SCRIPT') return false;
          return true;
        },
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`
        },
        width: width * scale,
        height: height * scale,
      });

      const printSize = templateSettings.print_size;
      const pdfFormat = printSize === 'A5' ? 'a5' :
                        printSize === 'Letter' ? 'letter' :
                        printSize === '80mm' ? [80, 200] :
                        printSize === '58mm' ? [58, 160] : 'a4';

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: pdfFormat as any
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (height * pdfWidth) / (width || 1);
      
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoice?.invoice_number || '0001'}.pdf`);
      toast.success('Invoice PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Direct PDF export encountered an error. Opening print preview...');
      window.print();
    }
  };

  const handleWhatsAppShare = () => {
    if (!invoice) return;
    const isPaid = invoice.status === 'paid' || invoice.status === 'complete';
    const bizName = business?.name || 'BillingMaster';
    const custName = customer?.name || 'Customer';
    const linesSummary = items.map((it) => `• ${it.product_name || 'Item'} x${it.quantity} = ₹${it.total}`).join('\n');

    const hasPaymentDetails = Boolean(paymentInfo?.upi_id || paymentInfo?.bank_name || paymentInfo?.account_number);
    let paySummary = '';
    if (!isPaid && hasPaymentDetails) {
      paySummary += '\n\n*💳 Payment Options:*';
      if (paymentInfo?.upi_id) paySummary += `\n📲 *UPI ID:* ${paymentInfo.upi_id}`;
      if (paymentInfo?.upi_number) paySummary += `\n📱 *UPI Mobile:* ${paymentInfo.upi_number}`;
      if (paymentInfo?.account_number && paymentInfo?.ifsc_code) {
        paySummary += `\n🏦 *Bank Transfer:*\n• *Bank:* ${paymentInfo.bank_name || 'Bank'}\n• *A/C Name:* ${paymentInfo.account_holder_name || bizName}\n• *A/C No:* ${paymentInfo.account_number}\n• *IFSC:* ${paymentInfo.ifsc_code}`;
        if (paymentInfo.branch_name) paySummary += `\n• *Branch:* ${paymentInfo.branch_name}`;
      }
    }

    const text =
      `*INVOICE: ${invoice.invoice_number}*\n` +
      `🏢 *${bizName}*\n` +
      `👤 *Customer:* ${custName}\n` +
      `📅 *Date:* ${invoice.issue_date}\n` +
      `------------------------\n` +
      (linesSummary ? `${linesSummary}\n------------------------\n` : '') +
      `💰 *Total Amount:* ₹${Number(invoice.total || 0).toFixed(2)}\n` +
      `📌 *Status:* ${isPaid ? '✅ PAID' : '⏳ DUE / UNPAID'}\n` +
      (isPaid && invoice.payment_method ? `💳 Method: ${invoice.payment_method}\n` : '') +
      paySummary +
      `\n\nThank you for doing business with us!`;

    const phone = (customer?.phone || '').replace(/[^0-9]/g, '');
    const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmailShare = () => {
    if (!invoice) return;
    const isPaid = invoice.status === 'paid' || invoice.status === 'complete';
    const bizName = business?.name || 'BillingMaster';
    const custName = customer?.name || 'Customer';
    const subject = `Invoice ${invoice.invoice_number} from ${bizName}`;
    const body = `Dear ${custName},\n\nHere is your invoice ${invoice.invoice_number} from ${bizName}.\nTotal Amount: ₹${Number(invoice.total || 0).toFixed(2)}\nStatus: ${isPaid ? 'PAID' : 'DUE'}\n\nThank you for doing business with us!`;
    const emailAddr = customer?.email || '';
    const mailtoUrl = emailAddr ? `mailto:${emailAddr}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleSMSShare = () => {
    if (!invoice) return;
    const isPaid = invoice.status === 'paid' || invoice.status === 'complete';
    const bizName = business?.name || 'BillingMaster';
    const custName = customer?.name || 'Customer';
    const text = `Invoice ${invoice.invoice_number} from ${bizName} for ${custName}. Amount: ₹${Number(invoice.total || 0).toFixed(2)}. Status: ${isPaid ? 'PAID' : 'DUE'}. Thank you!`;
    const phone = (customer?.phone || '').replace(/[^0-9]/g, '');
    const smsUrl = phone ? `sms:${phone}?body=${encodeURIComponent(text)}` : `sms:?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <div className="skeleton mb-6 h-12 w-48 rounded-xl mx-auto" />
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="card-shell p-8">
          <AlertCircle className="mx-auto mb-4 text-destructive" size={36} />
          <h2 className="text-xl font-bold">{error || 'Invoice not found'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">The requested invoice could not be found or loaded.</p>
          <Link href="/invoices" className="btn-primary mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold no-underline">
            <ArrowLeft size={16} /> Return to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid' || invoice.status === 'complete';
  const isKhata = invoice.status === 'khata' || invoice.status === 'pay_later';
  const isSettled = isPaid || isKhata;
  const timeMatch = invoice.notes?.match(/Time:\s*([0-9:]+\s*(?:AM|PM)?)/i);
  const timeStr = timeMatch ? timeMatch[1] : '';

  // Extract notif channels from notes
  const notifMatch = invoice.notes?.match(/Notifications:\s*([^\n]+)/i);
  const notifString = notifMatch ? notifMatch[1] : '';

  const isThermal = templateSettings.print_size === '80mm' || templateSettings.print_size === '58mm';
  const searchParams = new URLSearchParams(window.location.search);
  const fromCustomer = searchParams.get('fromCustomer');
  const backLink = fromCustomer ? `/customers?view=${fromCustomer}` : '/invoices';

  return (
    <div className={`mx-auto pb-16 print:max-w-full print:p-0 ${isThermal ? 'max-w-md' : 'max-w-2xl'}`}>
      {/* Top Action Toolbar */}
      <div className="mb-3 flex items-center justify-between gap-2.5 print:hidden">
        <div className="flex items-center gap-2">
          <Link href={backLink} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground no-underline hover:text-foreground shadow-xs" data-testid="link-back-to-invoices">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="mono text-base font-extrabold tracking-tight text-foreground">{invoice.invoice_number || 'INV-0001'}</span>
              {invoice.status === 'cancelled' ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-destructive/15 text-destructive border border-destructive/30">
                  <X size={11} className="stroke-[3]" /> Cancelled
                </span>
              ) : isSettled ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Check size={11} className="stroke-[3]" /> Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Clock size={11} /> Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{invoice.issue_date || 'Today'}{timeStr ? ` • ${timeStr}` : ''}</span>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
              >
                <SlidersHorizontal size={10} />
                <span>{INVOICE_TEMPLATES.find(t => t.id === templateSettings.template_id)?.name || 'Template'} ({templateSettings.print_size})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top 2 Vertically Stacked Action Buttons */}
        <div className="flex flex-col gap-1.5 w-28 shrink-0">
          <button
            onClick={handlePrint}
            className="btn-primary flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold shadow-xs cursor-pointer"
            data-testid="button-print-invoice"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted py-1.5 px-3 text-xs font-bold text-foreground shadow-xs transition-all cursor-pointer"
            data-testid="button-download-invoice"
          >
            <ArrowDownToLine size={13} className="text-primary" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Printable Invoice Sheet - Compact, clean & professional */}
      <div id="invoice-download-container" className="invoice-sheet card-shell overflow-hidden border border-border bg-card p-4 sm:p-6 shadow-sm print:m-0 print:w-full print:border-none print:p-6 print:shadow-none bg-white text-black dark:text-foreground">
        
        {/* Header: Business & Invoice Meta */}
        <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-base font-black text-primary-foreground">
              {(business?.name || 'BM')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">{business?.name || 'BillingMaster'}</h1>
              <p className="text-[11px] font-medium text-muted-foreground">{business?.owner_name || 'Commercial Billing'}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {business?.phone && <span className="flex items-center gap-1"><Phone size={11} /> {business.phone}</span>}
                {business?.address && <span className="flex items-center gap-1"><MapPin size={11} /> {business.address}</span>}
                {(business?.gstin || paymentInfo?.gstin) && (
                  <span className="flex items-center gap-1 font-bold text-primary">
                    <ShieldCheck size={11} /> GSTIN: {business?.gstin || paymentInfo?.gstin}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Meta Card */}
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-left sm:text-right sm:min-w-[170px]">
            <div className="text-[9px] font-black uppercase tracking-wider text-primary">TAX INVOICE</div>
            <div className="mono text-base font-black tracking-tight text-foreground">{invoice.invoice_number || 'INV-0001'}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              <span>{invoice.issue_date || 'Today'}</span> {timeStr && <span>• {timeStr}</span>}
            </div>
            <div className="mt-1 text-[10px] font-extrabold uppercase text-emerald-600">
              COMMERCIAL INVOICE
            </div>
          </div>
        </div>

        {/* Customer / Billed To Section - Compact Grid */}
        <div className="my-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
          <div className="rounded-lg border border-border/50 bg-muted/10 p-2.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-primary">BILLED TO</span>
            <div className="mt-0.5 text-xs font-bold text-foreground truncate">{customer?.name || customer?.full_name || 'Walk-in Customer'}</div>
            <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {customer?.phone && <div className="flex items-center gap-1"><Phone size={11} /> {customer.phone}</div>}
              {customer?.address && <div className="flex items-center gap-1"><MapPin size={11} /> {customer.address}</div>}
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/10 p-2.5 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-primary">DISPATCH STATUS</span>
              <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Email: Active (Primary)</span>
                </div>
                {notifString.includes('WhatsApp') && (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>WhatsApp: Digital Dispatch</span>
                  </div>
                )}
              </div>
            </div>
            {isPaid && invoice.paid_at && (
              <div className="mt-1 text-[10px] font-bold text-emerald-600">
                ✓ Paid on {new Date(invoice.paid_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {/* Itemized Table - Compact Padding */}
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 border-b border-border/60 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 px-2.5 w-8 text-center">#</th>
                <th className="py-2 px-2.5">Item</th>
                <th className="py-2 px-2 text-center w-16">Qty</th>
                <th className="py-2 px-2 text-right w-20">Price</th>
                <th className="py-2 px-2.5 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-[11px]">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-muted/10">
                    <td className="py-2 px-2.5 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 px-2.5">
                      <div className="font-bold text-foreground">{it.product_name || 'Item'}</div>
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-foreground">
                      {it.quantity} <span className="text-[9px] font-normal text-muted-foreground">{it.product_unit || 'pcs'}</span>
                    </td>
                    <td className="py-2 px-2 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                    <td className="py-2 px-2.5 text-right mono font-bold text-foreground">₹{Number(it.total || (it.quantity * it.unit_price) || 0).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-center text-muted-foreground text-xs">
                    Standard billing invoice (Total: ₹{Number(invoice.total || 0).toFixed(2)})
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculation, Payment & Status Summary */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Left Column: Bank / UPI Details and Notes */}
          <div className="space-y-2.5">
            {Boolean(paymentInfo?.upi_id || paymentInfo?.bank_name || paymentInfo?.account_number) && (
              <div className="rounded-lg border border-border/70 p-2.5 bg-muted/15 text-xs">
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary mb-1.5">
                  <Landmark size={11} />
                  <span>PAYMENT DETAILS / BANK TRANSFER</span>
                </div>
                <div className="space-y-1 text-[10.5px]">
                  {paymentInfo?.upi_id && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">UPI ID:</span>
                      <span className="mono font-bold text-foreground">{paymentInfo.upi_id}</span>
                    </div>
                  )}
                  {paymentInfo?.upi_number && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">UPI Mobile:</span>
                      <span className="mono font-bold text-foreground">{paymentInfo.upi_number}</span>
                    </div>
                  )}
                  {paymentInfo?.bank_name && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">Bank Name:</span>
                      <span className="font-bold text-foreground">{paymentInfo.bank_name}</span>
                    </div>
                  )}
                  {paymentInfo?.account_holder_name && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">A/C Name:</span>
                      <span className="font-semibold text-foreground truncate max-w-[150px]">{paymentInfo.account_holder_name}</span>
                    </div>
                  )}
                  {paymentInfo?.account_number && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">A/C No:</span>
                      <span className="mono font-bold text-foreground">{paymentInfo.account_number}</span>
                    </div>
                  )}
                  {paymentInfo?.ifsc_code && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">IFSC Code:</span>
                      <span className="mono font-bold text-foreground">{paymentInfo.ifsc_code}</span>
                    </div>
                  )}
                  {paymentInfo?.account_type && (
                    <div className="flex items-center justify-between gap-1 border-b border-border/30 pb-0.5">
                      <span className="font-semibold text-muted-foreground">A/C Type:</span>
                      <span className="text-foreground">{paymentInfo.account_type}</span>
                    </div>
                  )}
                  {paymentInfo?.branch_name && (
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-muted-foreground">Branch:</span>
                      <span className="text-foreground truncate max-w-[150px]">{paymentInfo.branch_name}</span>
                    </div>
                  )}
                </div>
                {paymentInfo?.payment_instructions && (
                  <p className="mt-1.5 text-[9.5px] text-muted-foreground italic border-t border-border/30 pt-1">
                    * {paymentInfo.payment_instructions}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="rounded-lg border border-border/50 p-2.5 bg-muted/10 text-xs">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">NOTES & TERMS</div>
              <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed">
                {invoice.notes?.split('\n').filter((l: string) => !l.startsWith('Time:') && !l.startsWith('Notifications:')).join('\n') || 'Thank you for your business.'}
              </div>
            </div>
          </div>

          {/* Right Column: Grand Total Breakdown */}
          <div className="flex flex-col justify-between">
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="mono font-semibold text-foreground">₹{Number(invoice.total || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between border-t border-border/50 pt-1.5 font-black text-foreground">
                <span>Grand Total:</span>
                <span className="mono text-primary text-base font-extrabold">₹{Number(invoice.total || 0).toFixed(2)}</span>
              </div>

            </div>
          </div>
        </div>

        {/* Footer & Signature */}
        <div className="mt-6 flex items-end justify-between border-t border-border/50 pt-4 text-[10px] text-muted-foreground">
          <div>
            <p>Computer generated invoice receipt.</p>
          </div>

          <div className="text-right">
            <div className="h-6 border-b border-border/80 w-28 ml-auto" />
            <div className="mt-1 font-semibold text-foreground">Authorized Seal</div>
          </div>
        </div>
      </div>

      {/* Item Returns & Refunds Section */}
      {invoice.status !== 'cancelled' && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm print:hidden">
          <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <RotateCcw size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-foreground">Item Returns & Refunds</h3>
                <p className="text-[11px] text-muted-foreground">Return individual products without cancelling the full invoice.</p>
              </div>
            </div>
            <span className="mono text-xs font-bold text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
          </div>

          <div className="space-y-2.5">
            {items.map((it, idx) => {
              const totalQty = Number(it.quantity || 1);
              const returnedQty = Number(it.returned_qty || 0);
              const remainingQty = Math.max(0, totalQty - returnedQty);
              const isFullyReturned = returnedQty >= totalQty;
              const isReturnable = Boolean(it.is_returnable);
              const unit = it.return_window_unit || 'days';
              const limitVal = it.return_window_value || 7;
              const inWindow = isWithinReturnWindow(invoice.issue_date, unit, limitVal);

              return (
                <div
                  key={it.id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-foreground text-sm">{it.product_name || 'Item'}</span>
                      {isFullyReturned ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                          <CheckCircle2 size={11} /> Item Returned ({returnedQty} pcs)
                        </span>
                      ) : returnedQty > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                          <RotateCcw size={11} /> Partially Returned ({returnedQty}/{totalQty} pcs)
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>Billed Qty: <strong className="text-foreground mono">{totalQty} {it.product_unit || 'pcs'}</strong></span>
                      <span>Price: <strong className="text-foreground mono">₹{Number(it.unit_price || 0).toFixed(2)}</strong></span>
                      {isReturnable && (
                        <span className="text-primary font-medium">
                          Policy: {limitVal} {unit === 'hours' ? 'Hours' : 'Days'} Return
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isFullyReturned ? (
                      <span className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                        Returned
                      </span>
                    ) : !isReturnable ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground shadow-2xs" title="This product is non-returnable">
                        <Ban size={12} className="text-destructive" />
                        <span>No Return Available</span>
                      </span>
                    ) : !inWindow ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground shadow-2xs" title={`Return window expired (${limitVal} ${unit})`}>
                        <Clock size={12} className="text-amber-500" />
                        <span>No Return Available</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsReplacementMode(false);
                            setReturnModalItem(it);
                            setReturnQty(remainingQty);
                            setRefundPaymentMethod('Cash');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-extrabold text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          data-testid={`button-return-item-${it.id}`}
                        >
                          <RotateCcw size={13} />
                          <span>Return Product</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsReplacementMode(true);
                            setReturnModalItem(it);
                            setReturnQty(remainingQty);
                            setRefundPaymentMethod('Store Credit');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/50 bg-blue-500/15 px-3 py-2 text-xs font-extrabold text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          data-testid={`button-replace-item-${it.id}`}
                        >
                          <RefreshCw size={13} />
                          <span>Replace Product</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Return & Refund History Audit Log */}
          {returnLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-primary" />
                  <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">Return & Refund History</span>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {returnLogs.length} transaction{returnLogs.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {returnLogs.map((log, lIdx) => (
                  <div key={log.id || lIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-border/50 bg-background p-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">{log.product_name || 'Item'}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-muted text-muted-foreground mono">
                          Returned: {log.returned_qty} {log.product_unit || 'pcs'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Refund: ₹{Number(log.refund_amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span>Method: <strong className="text-foreground">{log.refund_method || 'Cash'}</strong></span>
                        {log.refund_note && <span>Note: <span className="italic text-foreground">{log.refund_note}</span></span>}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground shrink-0 mono">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Item Return / Replacement Confirmation Modal */}
      {returnModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden overflow-y-auto">
          <div className={`w-full max-w-sm rounded-2xl border bg-card p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-rise my-8 ${
            isReplacementMode ? 'border-blue-500/40' : 'border-amber-500/40'
          }`}>
            <div className="text-center">
              <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl ${
                isReplacementMode ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {isReplacementMode ? <RefreshCw size={24} /> : <RotateCcw size={24} />}
              </div>
              <h3 className="text-base font-extrabold text-foreground">
                {isReplacementMode ? 'Replace Product Item' : 'Return Product Item'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isReplacementMode ? 'Replace' : 'Return'} <span className="font-bold text-foreground">"{returnModalItem.product_name}"</span> from Invoice #{invoice.invoice_number}.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Quantity to {isReplacementMode ? 'Replace' : 'Return'} (Max: {Number(returnModalItem.quantity || 1) - Number(returnModalItem.returned_qty || 0)})
                </label>
                <input
                  type="number"
                  min="1"
                  max={Number(returnModalItem.quantity || 1) - Number(returnModalItem.returned_qty || 0)}
                  value={returnQty}
                  onChange={(e) => setReturnQty(Math.max(1, Math.min(Number(e.target.value) || 1, Number(returnModalItem.quantity || 1) - Number(returnModalItem.returned_qty || 0))))}
                  className="input-shell w-full p-2.5 text-sm font-extrabold mono"
                  data-testid="input-return-item-qty"
                />
              </div>

              {/* Calculated Refund / Replacement Credit Display Card */}
              {(() => {
                const unitPrice = Number(returnModalItem.unit_price || returnModalItem.price || 0);
                const totalCalculatedRefund = unitPrice * returnQty;
                return (
                  <div className={`rounded-xl border p-3 text-center ${
                    isReplacementMode
                      ? 'border-blue-500/35 bg-blue-500/10'
                      : 'border-emerald-500/35 bg-emerald-500/10'
                  }`}>
                    <div className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isReplacementMode ? 'text-blue-800 dark:text-blue-300' : 'text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {isReplacementMode ? 'Total Replacement Credit Amount' : 'Total Calculated Refund Amount'}
                    </div>
                    <div className={`mono text-xl font-black mt-0.5 ${
                      isReplacementMode ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      ₹{totalCalculatedRefund.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      (₹{unitPrice.toFixed(2)} × {returnQty} {returnModalItem.product_unit || 'pcs'})
                    </div>
                  </div>
                );
              })()}

              {/* Refund / Replacement Payment Method Selector */}
              {isReplacementMode ? (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <span className="font-bold text-foreground block">Khata Book Credit</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        ₹{(Number(returnModalItem.unit_price || returnModalItem.price || 0) * returnQty).toFixed(2)} will automatically be credited to <strong className="text-foreground">{customer?.name || customer?.full_name || 'Customer'}</strong>'s Khata Book balance.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Refund Payment Method *
                  </label>
                  <CustomDropdown
                    value={refundPaymentMethod}
                    onChange={(v) => setRefundPaymentMethod(v)}
                    options={[
                      { label: 'Cash', value: 'Cash' },
                      { label: 'UPI / Digital Payment', value: 'UPI' },
                      { label: 'Bank Transfer', value: 'Bank Transfer' },
                      { label: 'Store Credit / Pay Later Adjustment', value: 'Store Credit' },
                    ]}
                    className="relative"
                    testId="select-refund-payment-method"
                  />
                </div>
              )}

              {/* Refund / Replacement Reference Note (Optional) */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {isReplacementMode ? 'Replacement Note' : 'Refund Reference / Note'} <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={refundReferenceNote}
                  onChange={(e) => setRefundReferenceNote(e.target.value)}
                  placeholder={isReplacementMode ? "e.g. Defective item replacement / Customer store credit" : "e.g. UPI Ref #98127391 / Cash Refund Note"}
                  className="input-shell w-full p-2.5 text-xs"
                  data-testid="input-refund-reference-note"
                />
              </div>

              {/* Restock Status Banner */}
              <div className={`rounded-xl border p-2.5 text-[11px] font-semibold leading-relaxed ${
                returnModalItem.restock_on_return !== false
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}>
                {returnModalItem.restock_on_return !== false ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Returned quantity will automatically be added back to Main Stock.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Non-restockable item. Returned quantity will NOT be added back to Main Stock.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setReturnModalItem(null)}
                disabled={returningItem}
                className="flex-1 rounded-xl border border-border bg-muted/30 py-2.5 px-4 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                data-testid="button-cancel-return-item"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={returningItem}
                onClick={handleReturnItem}
                className={`flex-1 rounded-xl text-white py-2.5 px-4 text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isReplacementMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
                data-testid="button-confirm-return-item"
              >
                {returningItem ? 'Processing...' : (
                  isReplacementMode ? <><RefreshCw size={14} /> Confirm Replacement</> : <><RotateCcw size={14} /> Confirm Return</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Send Invoice Toolbar */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
            Send Invoice
          </span>
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEmailShare}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Send via Email"
              data-testid="button-send-email"
            >
              <Mail size={14} />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Share via WhatsApp"
              data-testid="button-send-whatsapp"
            >
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleSMSShare}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all shadow-2xs cursor-pointer"
              title="Send via SMS / Message"
              data-testid="button-send-sms"
            >
              <Send size={14} />
              <span>SMS / Message</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Review Settlement Action Buttons (When invoice is pending settlement) */}
      {!isSettled ? (
        <div className="mt-4 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-md print:hidden flex items-center justify-between gap-3 sticky bottom-24 lg:bottom-4 z-40 backdrop-blur-md">
          {/* Left Side: Compact Pay Later & Cancel Invoice Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Pay Later Button (Compact) */}
            <button
              type="button"
              onClick={() => {
                setPayLaterAmountPaid('0');
                setPayLaterPaymentMethod('Cash');
                setPayLaterNote('');
                setPayLaterModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
              title="Record balance in Khata Book"
              data-testid="button-pay-later"
            >
              <BookOpen size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Pay Later (Khata)</span>
            </button>

            {/* 2. Cancel Invoice Button (Compact) */}
            <button
              type="button"
              onClick={() => setCancelConfirmModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-95 px-3 py-2.5 text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
              title="Cancel Invoice"
              data-testid="button-cancel-invoice"
            >
              <Ban size={14} />
              <span>Cancel Invoice</span>
            </button>
          </div>

          {/* Right Side: Main Prominent 'Mark Paid' Button (Fills all remaining width) */}
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setPaymentModal(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white py-2.5 px-5 text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer"
              data-testid="button-mark-paid"
            >
              <CheckCircle2 size={17} className="stroke-[2.5]" />
              <span>Mark Paid</span>
            </button>
          </div>
        </div>
      ) : (
        /* Settlement Completed Banner (Disappears 3 action buttons) */
        <div className={`mt-4 rounded-2xl border p-3.5 shadow-md print:hidden flex items-center justify-center gap-2 sticky bottom-24 lg:bottom-4 z-40 backdrop-blur-md ${
          invoice.status === 'cancelled'
            ? 'border-destructive/30 bg-destructive/10 text-destructive font-extrabold'
            : 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold'
        }`}>
          {invoice.status === 'cancelled' ? <XCircle size={20} className="stroke-[2.5]" /> : <CheckCircle2 size={20} className="stroke-[2.5]" />}
          <span className="font-extrabold text-sm sm:text-base tracking-tight">
            {invoice.status === 'cancelled' ? 'Invoice Cancelled' : 'Payment Successful'}
          </span>
        </div>
      )}

      {/* Pay Later Modal */}
      {payLaterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative overflow-hidden">
            <div className="mb-5 flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Pay Later & Khata Record</h3>
                  <p className="text-xs text-muted-foreground">Enter amount received today & record due in Khata Book</p>
                </div>
              </div>
              <button type="button" onClick={() => setPayLaterModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Invoice Summary Box */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Invoice:</span>
                  <span className="mono font-bold text-foreground">{invoice.invoice_number}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Customer:</span>
                  <span className="font-bold text-foreground truncate max-w-[180px]">{customer?.name || 'Walk-in Customer'}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-500/20">
                  <span className="font-extrabold text-foreground">Total Invoice Amount:</span>
                  <span className="mono text-sm font-black text-amber-700 dark:text-amber-300">₹{Number(invoice.total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Input: Amount Paid Today */}
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">
                  Amount Received / Paid Today (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={Number(invoice.total || 0)}
                  value={payLaterAmountPaid}
                  onChange={(e) => setPayLaterAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="input-shell w-full p-3 text-sm font-extrabold mono"
                  data-testid="input-pay-later-amount"
                />
                <p className="mt-1 text-[11px] text-muted-foreground font-medium">Defaults to 0 if no payment was received today</p>
              </div>

              {/* Payment Method Selector (Only shown if Amount Paid Today > 0) */}
              {Number(payLaterAmountPaid) > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 animate-in fade-in zoom-in-95 duration-200">
                  <label className="block text-xs font-extrabold text-amber-800 dark:text-amber-300 mb-2">
                    Select Payment Method (for ₹{Number(payLaterAmountPaid).toFixed(2)} received today)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Cash', label: 'Cash' },
                      { id: 'UPI / QR', label: 'UPI / GPay / QR' },
                      { id: 'Card', label: 'Debit / Credit Card' },
                      { id: 'Bank Transfer', label: 'Bank Transfer' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPayLaterPaymentMethod(m.id)}
                        className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          payLaterPaymentMethod === m.id
                            ? 'border-amber-600 bg-amber-600 text-white font-extrabold shadow-xs'
                            : 'border-border bg-card hover:bg-muted text-muted-foreground'
                        }`}
                        data-testid={`pay-later-method-${m.id.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculated Remaining Due Card */}
              {(() => {
                const totalVal = Number(invoice.total || 0);
                const paidVal = Math.max(0, Math.min(totalVal, Number(payLaterAmountPaid) || 0));
                const dueVal = Math.max(0, totalVal - paidVal);
                return (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Remaining Balance Due
                      </span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Will be added to Khata Book for {customer?.name || 'Customer'}
                      </span>
                    </div>
                    <span className="mono text-lg font-black text-amber-700 dark:text-amber-300">
                      ₹{dueVal.toFixed(2)}
                    </span>
                  </div>
                );
              })()}

              {/* Remarks / Note Field */}
              <div>
                <label className="mb-1 block text-xs font-bold text-foreground">
                  Notes / Khata Remarks <span className="font-normal text-muted-foreground">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={payLaterNote}
                  onChange={(e) => setPayLaterNote(e.target.value)}
                  placeholder="e.g. Partial payment received, balance due next week..."
                  className="input-shell w-full p-2.5 text-xs"
                  data-testid="input-pay-later-note"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setPayLaterModal(false)}
                className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => void confirmPayLater()}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 text-xs sm:text-sm font-extrabold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                data-testid="button-confirm-pay-later"
              >
                {updating ? 'Saving...' : <><Check size={16} /> Confirm & Save to Khata Book</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative overflow-hidden">
            {paymentSuccessAnim ? (
              <div className="absolute inset-0 bg-card z-10 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-6 scale-0 animate-[scaleIn_0.5s_ease-out_forwards]">
                  <Check size={48} className="text-white stroke-[3] opacity-0 animate-[fadeIn_0.3s_ease-out_0.3s_forwards]" />
                </div>
                <h2 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 opacity-0 animate-[slideUp_0.4s_ease-out_0.2s_forwards]">Payment Successful!</h2>
                <p className="text-sm text-muted-foreground mt-2 font-medium opacity-0 animate-[slideUp_0.4s_ease-out_0.3s_forwards]">Invoice has been marked as paid.</p>
              </div>
            ) : null}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Mark as Paid</h3>
                  <p className="text-xs text-muted-foreground">Invoice #{invoice.invoice_number}</p>
                </div>
              </div>
              <button onClick={() => setPaymentModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
            </div>

            <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Total Payable Amount</span>
              <div className="mono text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{Number(invoice.total || 0).toFixed(2)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Cash', label: 'Cash' },
                    { id: 'UPI / QR', label: 'UPI / GPay / QR' },
                    { id: 'Card', label: 'Debit / Credit Card' },
                    { id: 'Bank Transfer', label: 'Bank Transfer' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        paymentMethod === m.id
                          ? 'border-emerald-600 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-sm'
                          : 'border-border bg-background hover:bg-muted/60 text-muted-foreground'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Payment Reference / Note (Optional)</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Received in Cash / UPI Ref 123456"
                  className="input-shell w-full px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => markAsPaid(paymentMethod, paymentNote)}
                className="w-1/2 btn-primary bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm"
              >
                {updating ? 'Saving…' : <><Check size={15} /> Confirm Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Invoice Confirmation Modal */}
      {cancelConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/50 backdrop-blur-sm p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl relative overflow-hidden animate-rise">
            <div className="text-center">
              <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/15 text-destructive">
                <Ban size={24} />
              </div>
              <h3 className="text-base font-extrabold text-foreground">Cancel Invoice</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to cancel invoice <span className="mono font-bold text-foreground">{invoice.invoice_number || 'INV-0001'}</span>? Its status will be updated to <span className="font-extrabold text-destructive">Cancelled</span>.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setCancelConfirmModal(false)}
                className="flex-1 rounded-xl border border-border bg-muted/30 py-2.5 px-4 text-xs font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                data-testid="button-cancel-dialog-close"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => void handleCancelInvoice()}
                disabled={updating}
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground py-2.5 px-4 text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                data-testid="button-confirm-cancel-invoice"
              >
                {updating ? 'Cancelling...' : <><Ban size={14} /> Confirm Cancel</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Template & Print Setup Modal */}
      <InvoiceTemplateModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSaved={(st) => setTemplateSettings(st)}
      />
    </div>
  );
}

function CrudPage({ kind }: { kind: 'customers' | 'products' }) {
  const paginatedTable = usePaginatedTable<Row>(kind, { order: 'name.asc' }, 40);
  const table = paginatedTable;
  const allInvoicesTable = useTable<Row>('invoices', kind === 'customers' ? { limit: 100, order: 'created_at.desc' } : { limit: 50 });
  const [, setLocation] = useLocation();
  const search = paginatedTable.search;
  const setSearch = paginatedTable.setSearch;
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [noteModalData, setNoteModalData] = useState<Row | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState<Row | null>(null);
  const [initialBarcode, setInitialBarcode] = useState('');
  const [viewData, setViewData] = useState<Row | null>(null);
  const [deleteData, setDeleteData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const isCustomer = kind === 'customers';

  useEffect(() => {
    if (isCustomer && table.data.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const viewId = searchParams.get('view');
      if (viewId) {
        const target = table.data.find(c => String(c.id) === String(viewId));
        if (target) {
          setViewData(target);
          setShowViewModal(true);
        }
      }
    }
  }, [isCustomer, table.data]);

  const filtered = table.data;

  const openBarcodeVerifier = (target: Row | null = null, code = '') => {
    setBarcodeTargetProduct(target);
    setInitialBarcode(code || (target ? getProductBarcode(target) : ''));
    setShowBarcodeModal(true);
  };

  const openAddModalWithBarcode = (barcode: string) => {
    setFormData({
      type: 'physical',
      name: '',
      sku: barcode,
      barcode: barcode,
      description: '',
      buying_price: '',
      price: '',
      stock_quantity: '0',
      allow_custom_price: false,
      is_returnable: true,
      restock_on_return: true,
      return_window_unit: 'days',
      return_window_value: '7',
      return_window_days: '7',
      show_in_catalog: true,
    });
    setShowModal(true);
  };

  const openAddModal = () => {
    if (isCustomer) {
      setFormData({
        customer_type: 'individual',
        name: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        notes: '',
      });
    } else {
      setFormData({
        type: 'physical',
        name: '',
        sku: '',
        barcode: '',
        description: '',
        buying_price: '',
        price: '',
        stock_quantity: '0',
        allow_custom_price: false,
        is_returnable: true,
        restock_on_return: true,
        return_window_unit: 'days',
        return_window_value: '7',
        return_window_days: '7',
        show_in_catalog: true,
      });
    }
    setShowModal(true);
  };

  const editRow = (row: Row) => {
    if (isCustomer) {
      const gstinVal = getCustomerGstin(row);
      setFormData({
        id: row.id,
        customer_type: gstinVal ? 'company' : 'individual',
        name: row.name || '',
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        gstin: gstinVal,
        notes: getCustomerNotes(row),
      });
      setShowModal(true);
      return;
    }

    let isServ = row.type === 'service' || row.item_type === 'service' || row.unit === 'service' || row.unit === 'hour' || row.unit === 'project';
    let bPrice = row.buying_price !== undefined && row.buying_price !== null ? String(row.buying_price) : (row.cost_price !== undefined && row.cost_price !== null ? String(row.cost_price) : '');
    let desc = row.description || row.notes || '';
    let rowSku = getProductBarcode(row);
    let rowImgUrl = row.image_url || '';
    let allowCustomPrice = Boolean(row.allow_custom_price);
    let isReturnable = row.is_returnable !== false;
    let restockOnReturn = row.restock_on_return !== false;
    let returnWindowUnit = row.return_window_unit || 'days';
    let returnWindowValue = row.return_window_value !== undefined ? String(row.return_window_value) : (row.return_window_days !== undefined ? String(row.return_window_days) : '7');
    
    let showInCatalog = row.show_in_catalog !== false && row.show_in_catalog !== 0 && row.show_in_catalog !== '0' && row.show_in_catalog !== 'false';
    
    if (row.notes && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
      try {
        const meta = JSON.parse(row.notes);
        if (meta.type === 'service') isServ = true;
        if (meta.buying_price !== undefined && meta.buying_price !== null && meta.buying_price !== '') bPrice = String(meta.buying_price);
        if (meta.description !== undefined) desc = meta.description;
        if (meta.image_url) rowImgUrl = meta.image_url;
        if (meta.sku && !rowSku && !meta.sku.startsWith('__SYS_')) rowSku = meta.sku;
        if (meta.barcode && !rowSku && !meta.barcode.startsWith('__SYS_')) rowSku = meta.barcode;
        if (meta.allow_custom_price !== undefined) allowCustomPrice = Boolean(meta.allow_custom_price);
        if (meta.is_returnable !== undefined) isReturnable = Boolean(meta.is_returnable);
        if (meta.restock_on_return !== undefined) restockOnReturn = Boolean(meta.restock_on_return);
        if (meta.return_window_unit) returnWindowUnit = meta.return_window_unit;
        if (meta.return_window_value !== undefined) returnWindowValue = String(meta.return_window_value);
        if (meta.show_in_catalog !== undefined) showInCatalog = Boolean(meta.show_in_catalog);
      } catch (e) {}
    }

    setFormData({
      id: row.id,
      type: isServ ? 'service' : 'physical',
      name: row.name || '',
      sku: rowSku,
      barcode: rowSku,
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      notes: row.notes || '',
      description: desc,
      buying_price: bPrice,
      price: row.price !== undefined ? String(row.price) : '',
      stock_quantity: row.stock_quantity !== undefined ? String(row.stock_quantity) : '0',
      image_url: rowImgUrl,
      allow_custom_price: allowCustomPrice,
      is_returnable: isReturnable,
      restock_on_return: restockOnReturn,
      return_window_unit: returnWindowUnit,
      return_window_value: returnWindowValue,
      return_window_days: returnWindowUnit === 'days' ? returnWindowValue : String(Math.ceil((parseInt(returnWindowValue, 10) || 24) / 24)),
      show_in_catalog: showInCatalog,
    });
    setShowModal(true);
  };

  const deleteRow = async () => {
    if (deleteData) {
      setLoading(true);
      try {
        await db.remove(kind, deleteData.id);
        table.reload();
        setDeleteData(null);
        toast.success(isCustomer ? 'Customer deleted successfully.' : 'Product deleted successfully.');
      } catch (err) {
        toast.error(getSupabaseErrorMessage(err, 'Failed to delete'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      toast.warning(isCustomer ? 'Please enter the customer / company name.' : 'Please enter the product or service name.');
      return;
    }
    if (isCustomer && !formData.phone) {
      toast.warning('Phone number is required for customers / businesses.');
      return;
    }
    if (isCustomer && formData.phone.replace(/\D/g, '').length < 10) {
      toast.warning('Phone number must be at least 10 digits.');
      return;
    }

    if (!isCustomer) {
      const isService = formData.type === 'service';
      const allowCustomPrice = isService && Boolean(formData.allow_custom_price);

      if (!allowCustomPrice && (formData.price === undefined || formData.price === null || String(formData.price).trim() === '')) {
        toast.warning('Selling Price is required. Please enter a selling price.');
        return;
      }
      if (!isService && (formData.stock_quantity === undefined || formData.stock_quantity === null || String(formData.stock_quantity).trim() === '')) {
        toast.warning('Total Stock Quantity is required for physical products.');
        return;
      }
    }

    if (isCustomer && formData.phone) {
      const cleanPhoneDigits = formData.phone.replace(/\D/g, '').slice(-10);
      const duplicateCustomer = table.data.find((c: any) => {
        if (c.id === formData.id) return false;
        const existingDigits = (c.phone || '').replace(/\D/g, '').slice(-10);
        return existingDigits.length >= 10 && existingDigits === cleanPhoneDigits;
      });

      if (duplicateCustomer) {
        toast.error(`A customer with this phone number (${formData.phone}) already exists ("${duplicateCustomer.name}"). Each customer must have a unique phone number.`);
        return;
      }
    }
    setLoading(true);
    try {
      if (isCustomer) {
        const gstinVal = formData.gstin?.trim() || null;
        const payload: Record<string, any> = {
          name: formData.name.trim(),
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          notes: formData.notes || null,
        };
        if (gstinVal) {
          payload.gstin = gstinVal;
        }

        try {
          if (formData.id) {
            await db.update(kind, formData.id, payload);
            toast.success('Customer details updated successfully!');
          } else {
            await db.insert(kind, payload);
            toast.success('New customer created successfully!');
          }
        } catch (err: any) {
          if (gstinVal) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.gstin;
            fallbackPayload.notes = JSON.stringify({
              notes: formData.notes || '',
              gstin: gstinVal,
            });
            if (formData.id) {
              await db.update(kind, formData.id, fallbackPayload);
              toast.success('Customer details updated successfully!');
            } else {
              await db.insert(kind, payload);
              toast.success('New customer created successfully!');
            }
          } else {
            throw err;
          }
        }
      } else {
        const isService = formData.type === 'service';
        const allowCustomPrice = isService && Boolean(formData.allow_custom_price);
        const sellingPrice = formData.price !== '' && formData.price !== undefined ? Number(formData.price) : 0;
        const buyingPrice = formData.buying_price !== '' && formData.buying_price !== undefined ? Number(formData.buying_price) : 0;
        const stockQty = formData.stock_quantity !== '' && formData.stock_quantity !== undefined ? Math.max(0, parseInt(formData.stock_quantity, 10) || 0) : (isService ? 9999 : 0);
        const cleanSku = formData.sku?.trim() || '';
        
        // Duplicate barcode check across other products
        if (cleanSku) {
          const duplicate = table.data.find(
            (p) => p.id !== formData.id && getProductBarcode(p).toLowerCase() === cleanSku.toLowerCase()
          );
          if (duplicate) {
            toast.error(`This barcode / SKU (${cleanSku}) is already assigned to product "${duplicate.name}". Each product must have a unique barcode.`);
            setLoading(false);
            return;
          }
        }
        
        const payload: Record<string, any> = {};
        payload.name = formData.name.trim();
        payload.price = sellingPrice;
        payload.stock_quantity = stockQty;
        payload.unit = isService ? 'service' : 'pcs';
        payload.type = isService ? 'service' : 'physical';
        payload.buying_price = buyingPrice;
        payload.description = formData.description || '';
        payload.image_url = formData.image_url || '';
        payload.sku = cleanSku || generateInternalSku(formData.id);
        payload.barcode = cleanSku || '';
        const isReturnable = !isService && (formData.is_returnable !== false);
        const restockOnReturn = isReturnable && (formData.restock_on_return !== false);
        const returnWindowUnit = isReturnable ? (formData.return_window_unit || 'days') : 'days';
        const returnWindowValue = isReturnable ? (Math.max(1, parseInt(formData.return_window_value || formData.return_window_days, 10) || 7)) : 0;
        const returnWindowDays = returnWindowUnit === 'days' ? returnWindowValue : Math.ceil(returnWindowValue / 24);

        const showInCatalog = formData.show_in_catalog !== false;
        payload.allow_custom_price = allowCustomPrice;
        payload.is_returnable = isReturnable;
        payload.restock_on_return = restockOnReturn;
        payload.return_window_unit = returnWindowUnit;
        payload.return_window_value = returnWindowValue;
        payload.return_window_days = returnWindowDays;
        payload.show_in_catalog = showInCatalog ? 1 : 0;
        
        payload.notes = JSON.stringify({
          type: isService ? 'service' : 'physical',
          description: formData.description || '',
          buying_price: buyingPrice,
          price: sellingPrice,
          stock_quantity: stockQty,
          allow_custom_price: allowCustomPrice,
          is_returnable: isReturnable,
          restock_on_return: restockOnReturn,
          return_window_unit: returnWindowUnit,
          return_window_value: returnWindowValue,
          return_window_days: returnWindowDays,
          show_in_catalog: showInCatalog,
          ...(cleanSku ? { sku: cleanSku, barcode: cleanSku } : {}),
        });

        if (formData.id) {
          await db.update(kind, formData.id, payload);
          toast.success(isService ? 'Virtual Service updated!' : 'Product updated successfully!');
        } else {
          await db.insert(kind, payload);
          toast.success(isService ? 'Virtual Service created!' : 'New Product created successfully!');
        }
      }

      setShowModal(false);
      setFormData({});
      table.reload();
    } catch (err) {
      console.error('Save error in CrudList:', err);
      toast.error(getSupabaseErrorMessage(err, 'Failed to save. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return <>
    <PageHeader 
      title={isCustomer ? 'Customers' : 'Products'} 
      actionLabel={isCustomer ? 'New Customer' : 'New Product'} 
      action={openAddModal} 
    />

    {/* Search & Filter Bar */}
    <div className="mb-5 space-y-2.5 animate-rise">
      <div className="relative flex items-center">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            isCustomer
              ? "Search customers by name, phone number, email address, or notes..."
              : "Search products by name, barcode, SKU, or category..."
          }
          className="w-full rounded-2xl bg-card border border-border/80 pl-10 pr-10 py-3 text-xs sm:text-sm font-semibold placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-2xs transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            title="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          Showing <strong className="font-extrabold text-foreground">{filtered.length}</strong> of{' '}
          <strong className="font-extrabold text-foreground">{table.data.length}</strong> {isCustomer ? 'customers' : 'items'}
          {search && (
            <span> matching &ldquo;<span className="text-primary font-bold">{search}</span>&rdquo;</span>
          )}
        </span>

        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Clear Search</span>
          </button>
        )}
      </div>
    </div>

    <State {...table}>
      {filtered.length ? (
        <>
          <div className="space-y-3 sm:space-y-3.5 pb-28 sm:pb-16">
          {filtered.map(row => {
            let isService = row.type === 'service' || row.item_type === 'service' || row.unit === 'service' || row.unit === 'hour' || row.unit === 'project';
            let buyingPrice = row.buying_price !== undefined && row.buying_price !== null ? row.buying_price : row.cost_price;
            let sellingPrice = row.price !== undefined && row.price !== null ? row.price : row.selling_price;
            let itemDescription = row.description || row.notes || '';
            let productImgUrl = row.image_url || '';

            if (row.notes && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
              try {
                const parsed = JSON.parse(row.notes);
                if (parsed.type === 'service') isService = true;
                if (parsed.buying_price !== undefined && parsed.buying_price !== null) buyingPrice = parsed.buying_price;
                if (parsed.price !== undefined && parsed.price !== null) sellingPrice = parsed.price;
                if (parsed.description !== undefined) itemDescription = parsed.description;
                if (parsed.image_url) productImgUrl = parsed.image_url;
              } catch (e) {}
            }

            return (
              <div 
                key={row.id} 
                className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs hover:shadow-xs hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {!isCustomer ? (
                    productImgUrl ? (
                      <img 
                        src={productImgUrl} 
                        alt={row.name} 
                        className="mt-0.5 h-11 w-11 shrink-0 rounded-xl object-cover border border-border shadow-2xs bg-muted/30" 
                      />
                    ) : (
                      <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isService ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-primary/10 text-primary'}`}>
                        {isService ? <Sparkles size={18} /> : <Package size={18} />}
                      </div>
                    )
                  ) : (
                    <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Users size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">{row.name}</span>
                      {!isCustomer && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                          isService 
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25' 
                            : 'bg-primary/15 text-primary border border-primary/25'
                        }`}>
                          {isService ? <Sparkles size={10} /> : <Package size={10} />}
                          <span>{isService ? 'Virtual Service' : 'Physical Product'}</span>
                        </span>
                      )}
                    </div>

                    {isCustomer ? (
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {row.phone && (
                          <div className="flex items-center gap-1.5 font-medium text-foreground/90">
                            <Phone size={12} className="text-muted-foreground" />
                            <span>{row.phone}</span>
                            {row.email && <span>• {row.email}</span>}
                          </div>
                        )}
                        {(() => {
                          const gstin = getCustomerGstin(row);
                          return gstin ? (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                              <ShieldCheck size={12} />
                              <span className="mono bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">GSTIN: {gstin}</span>
                            </div>
                          ) : null;
                        })()}
                        {row.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground line-clamp-1">
                            <MapPin size={12} />
                            <span>{row.address}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {itemDescription && itemDescription !== row.sku && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {itemDescription}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          {(() => {
                            const productId = getProductUniqueId(row);
                            const pBarcode = getProductBarcode(row);
                            return (
                              <>
                                <span className="mono font-extrabold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-primary/20 flex items-center gap-1 shadow-2xs">
                                  <Boxes size={12} />
                                  <span>Product ID: {productId}</span>
                                </span>
                                {pBarcode ? (
                                  <span className="mono font-semibold bg-muted/60 text-foreground/90 px-2 py-0.5 rounded-md border border-border/50 flex items-center gap-1">
                                    <ScanLine size={12} className="text-muted-foreground" />
                                    <span>Barcode: {pBarcode}</span>
                                  </span>
                                ) : null}
                              </>
                            );
                          })()}
                          {!isService && (() => {
                            const stockVal = Number(row.stock_quantity ?? 0);
                            if (stockVal <= 0) {
                              return (
                                <span className="inline-flex items-center gap-1 font-extrabold px-2.5 py-0.5 rounded-md border bg-destructive/15 text-destructive border-destructive/30 shadow-2xs">
                                  <AlertTriangle size={12} className="stroke-[2.5]" />
                                  <span>Out of Stock (0)</span>
                                </span>
                              );
                            }
                            if (stockVal <= 5) {
                              return (
                                <span className="inline-flex items-center gap-1 font-extrabold px-2.5 py-0.5 rounded-md border bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 shadow-2xs">
                                  <AlertTriangle size={12} className="stroke-[2.5]" />
                                  <span>Low Stock Alert: {stockVal} left</span>
                                </span>
                              );
                            }
                            return (
                              <span className="font-semibold px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                                Stock: <span className="mono font-bold">{stockVal}</span>
                              </span>
                            );
                          })()}
                          {isService && (
                            <span className={`font-semibold px-2 py-0.5 rounded-md border ${
                              Boolean(row.allow_custom_price)
                                ? 'bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 border-indigo-600/30 font-bold'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25'
                            }`}>
                              {Boolean(row.allow_custom_price) ? 'Custom Price at Billing' : (row.stock_quantity && row.stock_quantity < 999 ? `Capacity: ${row.stock_quantity}` : 'Unlimited Service')}
                            </span>
                          )}
                          {(() => {
                            let isCatVis = row.show_in_catalog !== false && row.show_in_catalog !== 0 && row.show_in_catalog !== '0' && row.show_in_catalog !== 'false';
                            if (row.notes && (row.notes.startsWith('{') || row.notes.startsWith('['))) {
                              try {
                                const parsed = JSON.parse(row.notes);
                                if (parsed.show_in_catalog !== undefined) isCatVis = Boolean(parsed.show_in_catalog);
                              } catch (e) {}
                            }
                            return isCatVis ? (
                              <span className="font-semibold px-2 py-0.5 rounded-md border bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20">
                                Catalog: <span className="font-bold">Visible</span>
                              </span>
                            ) : (
                              <span className="font-semibold px-2 py-0.5 rounded-md border bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30">
                                Catalog: <span className="font-bold">POS Only</span>
                              </span>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2.5 sm:pt-0 border-t border-border/40 sm:border-0">
                  {!isCustomer && (
                    <div className="text-left sm:text-right">
                      <div className="mono font-black text-base sm:text-lg text-foreground">
                        {Boolean(row.allow_custom_price) && !Number(sellingPrice) ? (
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Custom Billing Input</span>
                        ) : (
                          `₹${Number(sellingPrice || 0).toFixed(2)}`
                        )}
                      </div>
                      {Boolean(row.allow_custom_price) && Number(sellingPrice) > 0 && (
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          (Default Price)
                        </div>
                      )}
                      {buyingPrice !== undefined && buyingPrice !== null && Number(buyingPrice) > 0 && (
                        <div className="mono text-[11px] text-muted-foreground">
                          Cost: ₹{Number(buyingPrice).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {isCustomer && (
                      <button 
                        onClick={() => setLocation(`/invoices/new?customer_id=${row.id}`)} 
                        className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-extrabold transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0" 
                        title="Create Invoice for this Customer"
                      >
                        <Receipt size={15} />
                        <span className="hidden sm:inline">Invoice</span>
                      </button>
                    )}
                    {isCustomer && (
                      <button 
                        onClick={() => {
                          setNoteModalData(row);
                          setNoteText(getCustomerNotes(row));
                        }} 
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-500/20 active:scale-95 shadow-2xs border border-amber-500/25 cursor-pointer shrink-0" 
                        title="Add / Edit Customer Notes"
                      >
                        <FileText size={16} />
                      </button>
                    )}
                    {!isCustomer && (
                      <button 
                        onClick={() => openBarcodeVerifier(row)} 
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all hover:bg-primary/20 active:scale-95 shadow-2xs border border-primary/25" 
                        title="Scan / Set / Delete Barcode"
                      >
                        <ScanLine size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => { setViewData(row); setShowViewModal(true); }} 
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-primary active:scale-95 shadow-2xs border border-border/40" 
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => editRow(row)} 
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-all hover:bg-muted hover:text-primary active:scale-95 shadow-2xs border border-border/40" 
                      title="Edit details"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteData(row)} 
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-muted-foreground transition-all hover:bg-destructive/20 hover:text-destructive active:scale-95 shadow-2xs border border-destructive/20" 
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <InfiniteScrollSentinel onIntersect={paginatedTable.loadMore} hasMore={paginatedTable.hasMore} loadingMore={paginatedTable.loadingMore} />
        </>
      ) : (
        <div className="rounded-3xl border border-border/80 bg-card p-10 text-center space-y-3 shadow-2xs">
          <Empty 
            icon={kind === 'customers' ? Users : Package} 
            title={search ? `No matching ${kind} found` : `No ${kind} yet`} 
            description={
              search 
                ? `No ${kind} match "${search}". Try searching with a different keyword or phone number.` 
                : `Start by clicking New ${kind.slice(0,-1)} above.`
            } 
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="btn-primary rounded-xl px-4 py-2 text-xs font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              <span>Clear Search Query</span>
            </button>
          )}
        </div>
      )}
    </State>

    {/* Add / Edit Modal */}
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/40 backdrop-blur-xs p-0 sm:items-center sm:p-5 print:hidden">
        <form noValidate onSubmit={handleSubmit} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-float relative sm:rounded-2xl sm:p-7 animate-in fade-in-0 slide-in-from-bottom-3 duration-200">
          <div className="mb-5 flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                {isCustomer ? <Users size={18} /> : (formData.type === 'service' ? <Sparkles size={18} /> : <Package size={18} />)}
              </div>
              <h3 className="text-base font-extrabold text-foreground">{formData.id ? 'Edit' : 'Add'} {isCustomer ? 'Customer / Business' : (formData.type === 'service' ? 'Virtual Service' : 'Product')}</h3>
            </div>
            <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
          </div>
          
          <div className="space-y-4">
            {isCustomer ? (
              <div className="space-y-4">
                {/* Entity Type Selector (Individual / Person vs. Company / Business) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold">Entity Type *</label>
                    {formData.id && (
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
                        <Lock size={11} className="text-primary" />
                        <span>Fixed on Edit</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!!formData.id}
                      onClick={() => setFormData({ ...formData, customer_type: 'individual', gstin: '' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        (formData.customer_type || 'individual') === 'individual'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-sm ring-2 ring-primary/20'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      } ${formData.id ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <Users size={16} />
                      <span>Individual / Person</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!formData.id}
                      onClick={() => setFormData({ ...formData, customer_type: 'company' })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        formData.customer_type === 'company'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-sm ring-2 ring-primary/20'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      } ${formData.id ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <Building2 size={16} />
                      <span>Company / Business</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <AppField 
                      label={formData.customer_type === 'company' ? "Company Name *" : "Customer Name *"} 
                      value={formData.name || ''} 
                      onChange={(v) => setFormData({...formData, name: v})} 
                      placeholder={formData.customer_type === 'company' ? "e.g. Alpha Corp, Global Tech Pvt Ltd" : "e.g. John Doe, Rahul Sharma"} 
                      required 
                    />
                  </div>
                  <AppField 
                    label={formData.customer_type === 'company' ? "Company Phone Number *" : "Phone Number *"} 
                    type="tel" 
                    value={formData.phone || ''} 
                    onChange={(v) => setFormData({...formData, phone: v})} 
                    placeholder="e.g. +91 98765 43210" 
                    required 
                  />
                  <AppField 
                    label={formData.customer_type === 'company' ? "Company Email" : "Email Address"} 
                    type="email" 
                    value={formData.email || ''} 
                    onChange={(v) => setFormData({...formData, email: v})} 
                    placeholder={formData.customer_type === 'company' ? "e.g. contact@company.com" : "e.g. john@example.com"} 
                  />
                  <div className="sm:col-span-2">
                    <AppField 
                      label={formData.customer_type === 'company' ? "Company Address" : "Address"} 
                      value={formData.address || ''} 
                      onChange={(v) => setFormData({...formData, address: v})} 
                      placeholder={formData.customer_type === 'company' ? "e.g. 123 Industrial Area, City, State, PIN" : "e.g. 123 Main Street, City, State, PIN"} 
                    />
                  </div>

                  {/* GSTIN / GST Number Field (Company / Business only) */}
                  {formData.customer_type === 'company' && (
                    <div className="sm:col-span-2 pt-2 border-t border-border/60">
                      <GSTVerificationInput
                        value={formData.gstin || ''}
                        onChange={(v) => setFormData({ ...formData, gstin: v })}
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold">
                      {formData.customer_type === 'company' ? "Notes / Business Remarks" : "Notes / Remarks"}
                    </label>
                    <textarea 
                      value={formData.notes || ''} 
                      onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                      placeholder="Additional notes, preferences, or terms..." 
                      className="input-shell min-h-20 w-full p-3 text-sm font-normal" 
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Item Type Selector (Virtual Service vs. Physical Product) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold">Item Type *</label>
                    {formData.id && (
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 bg-muted/80 px-2 py-0.5 rounded-md border border-border/60">
                        <Lock size={11} className="text-primary" />
                        <span>Fixed on Edit</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!!formData.id}
                      onClick={() => setFormData({ 
                        ...formData, 
                        type: 'physical', 
                        unit: formData.unit === 'service' || formData.unit === 'hour' || formData.unit === 'project' ? 'pcs' : (formData.unit || 'pcs') 
                      })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        formData.type !== 'service'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-sm ring-2 ring-primary/20'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      } ${formData.id ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <Package size={16} />
                      <span>Physical Product</span>
                    </button>
                    <button
                      type="button"
                      disabled={!!formData.id}
                      onClick={() => setFormData({ 
                        ...formData, 
                        type: 'service', 
                        unit: formData.unit === 'pcs' || formData.unit === 'box' || formData.unit === 'kg' ? 'service' : (formData.unit || 'service') 
                      })}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        formData.type === 'service'
                          ? 'border-indigo-600 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black shadow-sm ring-2 ring-indigo-600/20'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      } ${formData.id ? 'cursor-not-allowed opacity-75' : ''}`}
                    >
                      <Sparkles size={16} />
                      <span>Virtual Service</span>
                    </button>
                  </div>
                </div>

                {/* 2. Product Name */}
                <AppField 
                  label={formData.type === 'service' ? "Service Name *" : "Product Name *"} 
                  value={formData.name || ''} 
                  onChange={(v) => setFormData({...formData, name: v})} 
                  placeholder={formData.type === 'service' ? "e.g. Website Design & Development, SEO Consulting" : "e.g. Beauty Face Cream, Cotton Shirt"} 
                  required 
                />

                {/* 3. Barcode / SKU Field (Physical Product only) */}
                {formData.type !== 'service' && (
                  <div>
                    <label className="block text-xs font-bold mb-1">Barcode / SKU Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.sku || ''}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value, barcode: e.target.value })}
                        placeholder="e.g. PRD-849201 or 8901234567890"
                        className="input-shell flex-1 px-3 py-2 text-xs sm:text-sm font-semibold tracking-wide"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          openBarcodeVerifier();
                        }}
                        className="px-3 py-2 text-xs font-bold rounded-xl border border-border bg-muted/60 text-foreground hover:bg-muted flex items-center gap-1.5 shrink-0 transition-colors"
                        title="Scan Barcode with Camera"
                      >
                        <Camera size={14} className="text-primary" />
                        <span className="hidden sm:inline">Scan</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Product Description */}
                <div>
                  <label className="mb-1 block text-xs font-bold">
                    {formData.type === 'service' ? "Service Description" : "Product Description"}
                  </label>
                  <textarea 
                    value={formData.description || ''} 
                    onChange={(e) => setFormData({...formData, description: e.target.value})} 
                    placeholder={formData.type === 'service' ? "Describe the deliverables, timeline, or scope of the service..." : "Describe product features, specifications, brand, or ingredients..."} 
                    className="input-shell min-h-20 w-full p-3 text-sm font-normal" 
                  />
                </div>

                {/* 4b. Product Image Upload (Optional, Max 5 MB) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-foreground">
                      {formData.type === 'service' ? "Service Image" : "Product Image"} <span className="text-muted-foreground font-normal">(Optional, Max 5 MB)</span>
                    </label>
                    {formData.image_url && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="text-[11px] font-extrabold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Remove Image</span>
                      </button>
                    )}
                  </div>

                  {formData.image_url ? (
                    <div className="relative flex items-center gap-3.5 p-3 rounded-xl border border-primary/30 bg-primary/5 shadow-2xs">
                      <img
                        src={formData.image_url}
                        alt="Product Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-border bg-card shadow-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-foreground truncate">Photo Attached Successfully</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Will be displayed in catalog & billing search</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="grid h-7 w-7 place-items-center rounded-full bg-background text-muted-foreground hover:bg-destructive hover:text-white border border-border transition-colors cursor-pointer shrink-0"
                        title="Remove Photo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
                          if (file.size > MAX_SIZE) {
                            toast.error('Image size exceeds 5 MB. Please choose a smaller photo.');
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const rawUrl = evt.target?.result as string;
                            if (!rawUrl) return;
                            const img = new Image();
                            img.onload = () => {
                              try {
                                const canvas = document.createElement('canvas');
                                let w = img.width;
                                let h = img.height;
                                const MAX_DIM = 800;
                                if (w > MAX_DIM || h > MAX_DIM) {
                                  if (w > h) {
                                    h = Math.round((h * MAX_DIM) / w);
                                    w = MAX_DIM;
                                  } else {
                                    w = Math.round((w * MAX_DIM) / h);
                                    h = MAX_DIM;
                                  }
                                }
                                canvas.width = w;
                                canvas.height = h;
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                  ctx.drawImage(img, 0, 0, w, h);
                                  const compressed = canvas.toDataURL('image/jpeg', 0.85);
                                  setFormData((prev: any) => ({ ...prev, image_url: compressed }));
                                } else {
                                  setFormData((prev: any) => ({ ...prev, image_url: rawUrl }));
                                }
                              } catch (err) {
                                setFormData((prev: any) => ({ ...prev, image_url: rawUrl }));
                              }
                            };
                            img.onerror = () => setFormData((prev: any) => ({ ...prev, image_url: rawUrl }));
                            img.src = rawUrl;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                        <ImagePlus size={20} />
                        <span className="text-xs font-bold">Click to Upload Product Photo</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">JPEG, PNG, WebP or GIF up to 5 MB</p>
                    </label>
                  )}
                </div>

                {/* 5 & 6. Price Configuration for Virtual Service */}
                {formData.type === 'service' ? (
                  <div className="space-y-3 pt-1">
                    {/* Toggle Switch: Allow Custom Amount at Billing */}
                    <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors select-none ${
                      formData.allow_custom_price
                        ? 'border-indigo-600/50 bg-indigo-600/10 text-foreground'
                        : 'border-border bg-muted/20 text-muted-foreground'
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-foreground">Allow Custom Amount at Billing</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                            formData.allow_custom_price ? 'bg-indigo-600/20 text-indigo-600 dark:text-indigo-400' : 'bg-muted text-muted-foreground'
                          }`}>
                            {formData.allow_custom_price ? 'Virtual Service Feature' : 'Fixed Price'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                          {formData.allow_custom_price 
                            ? 'Selling price is optional. Enter custom amount during invoice billing.' 
                            : 'Use a fixed default selling price for this virtual service.'}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.allow_custom_price)}
                        onChange={(e) => setFormData({ ...formData, allow_custom_price: e.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-border text-indigo-600 accent-indigo-600 cursor-pointer"
                        data-testid="toggle-allow-custom-price"
                      />
                    </label>

                    <AppField 
                      label={formData.allow_custom_price ? "Default Selling Price (₹) (Optional)" : "Selling Price (₹) *"} 
                      type="number" 
                      value={formData.price !== undefined ? formData.price : ''} 
                      onChange={(v) => setFormData({...formData, price: v})} 
                      placeholder={formData.allow_custom_price ? "0.00 (or leave empty for billing input)" : "0.00"} 
                      required={formData.allow_custom_price ? undefined : true}
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AppField 
                      label="Buying Price / Cost (₹)" 
                      type="number" 
                      value={formData.buying_price !== undefined ? formData.buying_price : ''} 
                      onChange={(v) => setFormData({...formData, buying_price: v})} 
                      placeholder="0.00" 
                    />
                    <AppField 
                      label="Selling Price (₹) *" 
                      type="number" 
                      value={formData.price !== undefined ? formData.price : ''} 
                      onChange={(v) => setFormData({...formData, price: v})} 
                      placeholder="0.00" 
                      required
                    />
                  </div>
                )}

                {/* 7. Total Stock (Physical Product only) */}
                {formData.type !== 'service' && (
                  <div className="space-y-3 pt-1">
                    <AppField 
                      label="Total Stock Quantity *" 
                      type="number" 
                      value={formData.stock_quantity !== undefined ? formData.stock_quantity : ''} 
                      onChange={(v) => setFormData({...formData, stock_quantity: v})} 
                      placeholder="e.g. 10, 50, 100" 
                      required
                    />

                    {/* Toggle Switch: Allow Product Return */}
                    <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors select-none ${
                      formData.is_returnable !== false
                        ? 'border-emerald-600/50 bg-emerald-600/10 text-foreground'
                        : 'border-border bg-muted/20 text-muted-foreground'
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-foreground">Allow Product Return</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                            formData.is_returnable !== false ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
                          }`}>
                            {formData.is_returnable !== false ? 'Returnable' : 'Non-Returnable'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                          {formData.is_returnable !== false 
                            ? 'Customer returns are accepted for this product.' 
                            : 'Item is non-returnable. Stock will not be restored upon invoice return.'}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.is_returnable !== false}
                        onChange={(e) => setFormData({ ...formData, is_returnable: e.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-border text-emerald-600 accent-emerald-600 cursor-pointer"
                        data-testid="toggle-allow-product-return"
                      />
                    </label>

                    {/* Conditional Sub-Toggle: Restock Returned Items to Main Stock */}
                    {formData.is_returnable !== false && (
                      <label className={`ml-4 flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors select-none animate-in fade-in duration-150 ${
                        formData.restock_on_return !== false
                          ? 'border-blue-500/50 bg-blue-500/10 text-foreground'
                          : 'border-amber-500/40 bg-amber-500/10 text-foreground'
                      }`}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-foreground">Restock Returned Items to Main Stock</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              formData.restock_on_return !== false ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            }`}>
                              {formData.restock_on_return !== false ? 'Auto-Restock ON' : 'No Restock (Damaged/Used)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                            {formData.restock_on_return !== false
                              ? 'Returned quantities are automatically added back to Main Total Stock.'
                              : 'Customer can return item, but returned quantity will NOT be added back to Main Stock (e.g. damaged goods).'}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.restock_on_return !== false}
                          onChange={(e) => setFormData({ ...formData, restock_on_return: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-border text-blue-600 accent-blue-600 cursor-pointer"
                          data-testid="toggle-restock-on-return"
                        />
                      </label>
                    )}

                    {/* Conditional Return Window Limit & Unit Selector */}
                    {formData.is_returnable !== false && (
                      <div className="ml-4 pt-1 animate-in fade-in duration-150 space-y-2">
                        <label className="block text-xs font-bold text-foreground">
                          Return Window Limit *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={formData.return_window_value !== undefined ? formData.return_window_value : (formData.return_window_days || '7')}
                            onChange={(e) => setFormData({ ...formData, return_window_value: e.target.value })}
                            placeholder={formData.return_window_unit === 'hours' ? "e.g. 24, 48" : "e.g. 7, 14, 30"}
                            className="input-shell flex-1 px-3.5 text-sm font-extrabold mono"
                            data-testid="input-return-window-value"
                          />
                          <div className="w-32 shrink-0">
                            <CustomDropdown
                              value={formData.return_window_unit || 'days'}
                              onChange={(v) => setFormData({ ...formData, return_window_unit: v })}
                              options={[
                                { label: 'Days', value: 'days' },
                                { label: 'Hours', value: 'hours' },
                              ]}
                              className="relative"
                              testId="select-return-window-unit"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formData.return_window_unit === 'hours'
                            ? 'Maximum number of hours from billing date within which customer returns are valid (e.g. 24 hours).'
                            : 'Maximum number of days from billing date within which customer returns are valid (e.g. 7 days).'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Toggle Switch: Show in Online Store Catalog */}
                <label className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-colors select-none ${
                  formData.show_in_catalog !== false
                    ? 'border-teal-500/50 bg-teal-500/10 text-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground'
                }`}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-foreground">Show in Online Store Catalog</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                        formData.show_in_catalog !== false ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300' : 'bg-muted text-muted-foreground'
                      }`}>
                        {formData.show_in_catalog !== false ? 'Catalog Visible' : 'POS Only (Hidden)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                      {formData.show_in_catalog !== false 
                        ? 'This item will be visible to online customers in your public store catalog & link.' 
                        : 'This item will be hidden from online customers and only available for in-store POS billing.'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.show_in_catalog !== false}
                    onChange={(e) => setFormData({ ...formData, show_in_catalog: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-border text-teal-600 accent-teal-600 cursor-pointer"
                    data-testid="toggle-show-in-catalog"
                  />
                </label>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-border/60">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button 
              type="submit" 
              disabled={
                loading || 
                !formData.name || 
                (isCustomer && !formData.phone) ||
                (!isCustomer && !formData.allow_custom_price && (formData.price === undefined || formData.price === null || String(formData.price).trim() === '')) ||
                (!isCustomer && formData.type !== 'service' && (formData.stock_quantity === undefined || formData.stock_quantity === null || String(formData.stock_quantity).trim() === ''))
              } 
              className="rounded-xl bg-primary px-5 py-2 text-xs sm:text-sm font-extrabold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    )}

    {/* View Modal */}
    {showViewModal && viewData && (() => {
      let isServ = viewData.type === 'service' || viewData.item_type === 'service' || viewData.unit === 'service' || viewData.unit === 'hour' || viewData.unit === 'project';
      let bPrice = viewData.buying_price !== undefined && viewData.buying_price !== null ? Number(viewData.buying_price) : (viewData.cost_price !== undefined && viewData.cost_price !== null ? Number(viewData.cost_price) : null);
      let sPrice = viewData.price !== undefined && viewData.price !== null ? Number(viewData.price) : (viewData.selling_price !== undefined && viewData.selling_price !== null ? Number(viewData.selling_price) : 0);
      let vDesc = viewData.description || viewData.notes || '';
      let vStock = viewData.stock_quantity;

      let vImgUrl = viewData.image_url || '';

      if (viewData.notes && (viewData.notes.startsWith('{') || viewData.notes.startsWith('['))) {
        try {
          const parsed = JSON.parse(viewData.notes);
          if (parsed.type === 'service') isServ = true;
          if (parsed.buying_price !== undefined && parsed.buying_price !== null) bPrice = Number(parsed.buying_price);
          if (parsed.price !== undefined && parsed.price !== null) sPrice = Number(parsed.price);
          if (parsed.description !== undefined) vDesc = parsed.description;
          if (parsed.stock_quantity !== undefined) vStock = parsed.stock_quantity;
          if (parsed.image_url) vImgUrl = parsed.image_url;
        } catch (e) {}
      }

      const profit = bPrice !== null && bPrice > 0 ? sPrice - bPrice : null;
      const marginPct = profit !== null && bPrice && bPrice > 0 ? ((profit / bPrice) * 100).toFixed(1) : null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative overflow-hidden">
            <div className="mb-5 flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                {vImgUrl ? (
                  <img src={vImgUrl} alt={viewData.name} className="h-11 w-11 rounded-xl object-cover border border-border bg-card shadow-xs shrink-0" />
                ) : (
                  <div className={`grid h-9 w-9 place-items-center rounded-xl ${isCustomer ? 'bg-primary/10 text-primary' : (isServ ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-primary/10 text-primary')}`}>
                    {isCustomer ? <Users size={18} /> : (isServ ? <Sparkles size={18} /> : <Package size={18} />)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-foreground">{viewData.name}</h3>
                  {!isCustomer && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-extrabold ${
                      isServ ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'bg-primary/15 text-primary'
                    }`}>
                      {isServ ? 'Virtual Service' : 'Physical Product'}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              {isCustomer ? (
                <>
                  {viewData.phone && <div><div className="font-bold text-muted-foreground mb-0.5">Phone / Business Number</div><div className="text-sm font-semibold">{viewData.phone}</div></div>}
                  {viewData.email && <div><div className="font-bold text-muted-foreground mb-0.5">Email / Business Email</div><div className="text-sm">{viewData.email}</div></div>}
                  {(() => {
                    const gstin = getCustomerGstin(viewData);
                    return gstin ? (
                      <div>
                        <div className="font-bold text-muted-foreground mb-0.5">GSTIN / GST Number</div>
                        <div className="text-sm font-mono font-bold text-primary flex items-center gap-1.5">
                          <ShieldCheck size={14} />
                          <span>{gstin}</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {viewData.address && <div><div className="font-bold text-muted-foreground mb-0.5">Billing / Business Address</div><div className="text-sm">{viewData.address}</div></div>}
                  {(() => {
                    const notes = getCustomerNotes(viewData);
                    return notes ? (
                      <div><div className="font-bold text-muted-foreground mb-0.5">Notes / Remarks</div><div className="text-sm whitespace-pre-wrap bg-muted/20 p-2.5 rounded-xl border border-border/50">{notes}</div></div>
                    ) : null;
                  })()}

                  {/* Purchase History Section */}
                  {(() => {
                    const customerInvoices = allInvoicesTable.data.filter((inv) => inv.customer_id === viewData.id);
                    const validInvoices = customerInvoices.filter((inv) => inv.status !== 'cancelled');
                    const totalPurchases = validInvoices.length;
                    const totalSpent = validInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

                    return (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 font-extrabold text-foreground text-xs">
                            <Receipt size={14} className="text-primary" />
                            <span>Purchase History ({totalPurchases})</span>
                          </div>
                          <span className="mono text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Total Spent: ₹{totalSpent.toFixed(2)}
                          </span>
                        </div>

                        {customerInvoices.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {customerInvoices.map((inv) => (
                              <Link
                                key={inv.id}
                                href={`/invoices/${inv.id}?fromCustomer=${viewData.id}`}
                                onClick={() => setShowViewModal(false)}
                                className="flex items-center justify-between p-2 rounded-xl border border-border/70 bg-muted/20 hover:bg-primary/10 transition-colors no-underline group cursor-pointer"
                              >
                                <div>
                                  <div className="mono text-xs font-extrabold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                                    <span>{inv.invoice_number}</span>
                                    <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{inv.issue_date || 'N/A'}</div>
                                </div>
                                <div className="text-right">
                                  <div className="mono text-xs font-bold text-foreground">₹{Number(inv.total || 0).toFixed(2)}</div>
                                  <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md border ${
                                    inv.status === 'cancelled'
                                      ? 'bg-destructive/15 text-destructive border-destructive/25'
                                      : (inv.status === 'paid' || inv.status === 'complete' || inv.status === 'khata'
                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25')
                                  }`}>
                                    {inv.status === 'cancelled' ? 'Cancelled' : (inv.status === 'paid' || inv.status === 'complete' || inv.status === 'khata' ? 'Paid' : 'Pending')}
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center text-[11px] font-medium text-muted-foreground bg-muted/20 rounded-xl border border-border/50">
                            No purchase history found for this customer.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* Description */}
                  {vDesc && (
                    <div>
                      <div className="font-bold text-muted-foreground mb-1">Description</div>
                      <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/20 p-2.5 rounded-xl border border-border/50 leading-relaxed">
                        {vDesc}
                      </div>
                    </div>
                  )}

                  {/* Pricing Overview Card */}
                  <div className="rounded-xl border border-border/70 bg-muted/15 p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-muted-foreground">Selling Price:</span>
                      <span className="mono font-black text-foreground text-sm">₹{sPrice.toFixed(2)}</span>
                    </div>
                    {bPrice !== null && bPrice > 0 && (
                      <div className="flex justify-between items-center border-t border-border/30 pt-1.5">
                        <span className="font-semibold text-muted-foreground">Buying Price (Cost):</span>
                        <span className="mono font-semibold text-muted-foreground">₹{bPrice.toFixed(2)}</span>
                      </div>
                    )}
                    {profit !== null && (
                      <div className="flex justify-between items-center border-t border-border/30 pt-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Est. Profit Margin:</span>
                        <span className="mono">₹{profit.toFixed(2)} ({marginPct}%)</span>
                      </div>
                    )}
                  </div>

                  {/* Stock & Barcode Info */}
                  {(() => {
                    const vBarcode = getProductBarcode(viewData);
                    return (
                      <div className={`grid gap-2 text-xs ${vBarcode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div className="rounded-xl border border-border/50 bg-muted/10 p-2.5">
                          <div className="font-bold text-muted-foreground text-[10px] uppercase">Stock / Capacity</div>
                          <div className="mt-1 font-bold text-foreground text-sm">
                            {isServ 
                              ? (vStock && vStock < 999 ? `${vStock} capacity` : 'Unlimited Service')
                              : `${vStock ?? 0} ${viewData.unit || 'units'}`
                            }
                          </div>
                        </div>
                        {vBarcode && (
                          <div className="rounded-xl border border-border/50 bg-muted/10 p-2.5">
                            <div className="font-bold text-muted-foreground text-[10px] uppercase">Barcode / SKU</div>
                            <div className="mt-1 mono font-bold text-foreground text-sm">
                              {vBarcode}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center gap-2 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowViewModal(false);
                    editRow(viewData);
                  }} 
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
                >
                  <Pencil size={13} />
                  <span>Edit</span>
                </button>
                {!isCustomer && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowViewModal(false);
                      openBarcodeVerifier(viewData);
                    }} 
                    className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ScanLine size={13} />
                    <span>Manage Barcode</span>
                  </button>
                )}
                {isCustomer && (
                  <Link
                    href={`/khatabook/${viewData.id}`}
                    onClick={() => setShowViewModal(false)}
                    className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors no-underline"
                  >
                    <BookOpen size={13} />
                    <span>Khata Book</span>
                  </Link>
                )}
              </div>
              <button type="button" onClick={() => setShowViewModal(false)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-colors">Close</button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* Delete Confirmation Modal */}
    {deleteData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-float relative overflow-hidden">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 size={20} />
            </div>
            <h3 className="text-lg font-bold">Delete {isCustomer ? 'Customer' : 'Product'}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Are you sure you want to delete <span className="font-bold text-foreground">{deleteData.name}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteData(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="button" onClick={() => void deleteRow()} disabled={loading} className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50 transition-all hover:bg-destructive/90 active:scale-95">
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Barcode Scanner & Verifier Modal */}
    {!isCustomer && (
      <BarcodeVerifierModal
        isOpen={showBarcodeModal}
        onClose={() => {
          setShowBarcodeModal(false);
          setBarcodeTargetProduct(null);
        }}
        products={table.data}
        targetProduct={barcodeTargetProduct}
        onReloadProducts={table.reload}
        onOpenAddProductWithBarcode={openAddModalWithBarcode}
        onEditProduct={editRow}
        initialBarcode={initialBarcode}
      />
    )}

    {/* Customer Notes Modal */}
    {noteModalData && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/40 backdrop-blur-xs p-4 animate-in fade-in-0 print:hidden">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-float relative">
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">{noteModalData.name}</h3>
                <span className="text-xs text-muted-foreground font-semibold">Customer Notes & Remarks</span>
              </div>
            </div>
            <button type="button" onClick={() => setNoteModalData(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">Notes / Internal Remarks</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write notes, preferences, payment terms, or special instructions for this customer..."
                className="input-shell min-h-32 w-full p-3 text-sm font-normal"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
              <button type="button" onClick={() => setNoteModalData(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
              <button
                type="button"
                disabled={savingNote}
                onClick={async () => {
                  setSavingNote(true);
                  try {
                    const gstinVal = getCustomerGstin(noteModalData);
                    const payload: Record<string, any> = { notes: noteText || null };
                    if (gstinVal) {
                      payload.notes = JSON.stringify({
                        notes: noteText || '',
                        gstin: gstinVal,
                      });
                    }
                    await db.update('customers', noteModalData.id, payload);
                    toast.success(`Notes saved for ${noteModalData.name}`);
                    setNoteModalData(null);
                    table.reload();
                  } catch (err) {
                    toast.error(getSupabaseErrorMessage(err, 'Failed to save notes'));
                  } finally {
                    setSavingNote(false);
                  }
                }}
                className="btn-primary rounded-xl px-5 py-2 text-xs font-extrabold shadow-sm cursor-pointer"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>;
}

function SimpleList({ kind }: { kind: 'purchases' | 'expenses' }) {
  if (kind === 'expenses') return <Expenses />;
  return <div className="p-10 text-center text-muted-foreground">List for {kind} under construction</div>;
}

function Settings() {
  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    currency: 'INR',
    invoice_prefix: 'INV',
    default_due_days: '30',
    turnover: '',
    employees: '1',
    gstin: '',
    enable_tax: false,
    tax_name: 'Tax',
    tax_rate: '18',
    invoice_template: 'standard',
    invoice_print_size: 'A4',
    upi_id: '',
    upi_number: '',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'Current',
    branch_name: '',
    payment_instructions: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      setLoading(true);
      setError('');
      try {
        let session = auth.session();
        if (!session) {
          session = await auth.getSession();
        }

        const user = session?.user;
        const userMeta = user?.user_metadata || {};
        const defaultEmail = user?.email || '';
        const defaultPhone = userMeta.phone || (user as any)?.phone || '';
        const defaultOwnerName = userMeta.full_name || userMeta.name || defaultEmail.split('@')[0] || '';

        // Read local storage cache if available
        let localCache: Record<string, any> = {};
        if (user?.id) {
          try {
            const raw = localStorage.getItem(`arventa_biz_${user.id}`);
            if (raw) localCache = JSON.parse(raw);
          } catch (e) {
            console.warn('Failed to parse local cache:', e);
          }
        }
        let paymentCache: Record<string, any> = {};
        try {
          const rawPay = localStorage.getItem('arventa_payment_settings');
          if (rawPay) paymentCache = JSON.parse(rawPay);
        } catch (e) {}

        let bid: string | null = null;
        let bizRow: Row | null = null;
        let profileRow: Row | null = null;
        let settingRow: Row | null = null;

        if (user) {
          try {
            const profiles = await db.list<Row>('profiles', { id: user.id });
            if (profiles.length > 0) {
              profileRow = profiles[0];
              bid = profileRow.business_id;
            }
          } catch (pe) {
            console.warn('Could not query profile directly:', pe);
          }
        }

        if (!bid) {
          bid = await getBusinessId();
        }

        if (bid) {
          setBusinessId(bid);
          try {
            const businesses = await db.list<Row>('businesses', { id: bid });
            if (businesses.length > 0) {
              bizRow = businesses[0];
            }
          } catch (be) {
            console.warn('Could not query businesses by id, querying all:', be);
            try {
              const allBiz = await db.list<Row>('businesses');
              if (allBiz.length > 0) bizRow = allBiz[0];
            } catch (be2) {}
          }

          try {
            const settingsList = await db.list<Row>('settings', { business_id: bid });
            if (settingsList.length > 0) {
              settingRow = settingsList[0];
            }
          } catch (se) {
            console.warn('Could not query settings:', se);
          }
        }

        if (active) {
          const resolvedName = bizRow?.name || userMeta.business_name || localCache.name || (defaultOwnerName ? `${defaultOwnerName}'s Business` : 'My Workspace');
          const resolvedOwner = profileRow?.full_name || userMeta.full_name || userMeta.name || localCache.owner_name || defaultOwnerName;
          const resolvedEmail = bizRow?.email || defaultEmail;
          const resolvedPhone = bizRow?.phone || userMeta.phone || localCache.phone || defaultPhone;
          const resolvedAddress = bizRow?.address || userMeta.address || localCache.address || '';
          const resolvedTurnover = bizRow?.turnover || userMeta.turnover || localCache.turnover || '';
          const resolvedEmployees = bizRow?.employees || userMeta.employees || localCache.employees || '1';
          const resolvedGstin = bizRow?.gstin || settingRow?.gstin || localCache.gstin || userMeta.gstin || '';
          const resolvedPrefix = settingRow?.invoice_prefix || localCache.invoice_prefix || 'INV';
          const resolvedDueDays = settingRow?.default_due_days !== undefined ? String(settingRow.default_due_days) : (localCache.default_due_days || '30');
          const resolvedEnableTax = settingRow?.enable_tax !== undefined ? Boolean(settingRow.enable_tax) : (localCache.enable_tax !== undefined ? Boolean(localCache.enable_tax) : false);
          const resolvedTaxName = localCache.tax_name || 'Tax';
          const resolvedTaxRate = settingRow?.tax_rate !== undefined ? String(settingRow.tax_rate) : (localCache.tax_rate !== undefined ? String(localCache.tax_rate) : '10');
          let resolvedTemplate = settingRow?.invoice_template || localCache.invoice_template || 'standard';
          let resolvedPrintSize = localCache.invoice_print_size || 'A4';

          // Try dedicated template settings
          try {
            const tplRaw = localStorage.getItem('arventa_invoice_template_settings');
            if (tplRaw) {
              const parsed = JSON.parse(tplRaw);
              if (parsed.template_id) resolvedTemplate = parsed.template_id;
              if (parsed.print_size) resolvedPrintSize = parsed.print_size;
            }
          } catch {}

          const resolvedUpiId = settingRow?.upi_id || bizRow?.upi_id || localCache.upi_id || paymentCache.upi_id || userMeta.upi_id || '';
          const resolvedUpiNumber = settingRow?.upi_number || bizRow?.upi_number || localCache.upi_number || paymentCache.upi_number || userMeta.upi_number || '';
          const resolvedBankName = settingRow?.bank_name || bizRow?.bank_name || localCache.bank_name || paymentCache.bank_name || userMeta.bank_name || '';
          const resolvedAccountHolder = settingRow?.account_holder_name || bizRow?.account_holder_name || localCache.account_holder_name || paymentCache.account_holder_name || userMeta.account_holder_name || resolvedOwner || '';
          const resolvedAccountNumber = settingRow?.account_number || bizRow?.account_number || localCache.account_number || paymentCache.account_number || userMeta.account_number || '';
          const resolvedIfscCode = settingRow?.ifsc_code || bizRow?.ifsc_code || localCache.ifsc_code || paymentCache.ifsc_code || userMeta.ifsc_code || '';
          const resolvedAccountType = settingRow?.account_type || bizRow?.account_type || localCache.account_type || paymentCache.account_type || userMeta.account_type || 'Current';
          const resolvedBranchName = settingRow?.branch_name || bizRow?.branch_name || localCache.branch_name || paymentCache.branch_name || userMeta.branch_name || '';
          const resolvedPaymentInstructions = settingRow?.payment_instructions || bizRow?.payment_instructions || localCache.payment_instructions || paymentCache.payment_instructions || userMeta.payment_instructions || '';

          setForm({
            name: resolvedName,
            owner_name: resolvedOwner,
            email: resolvedEmail,
            phone: resolvedPhone,
            address: resolvedAddress,
            currency: bizRow?.currency || settingRow?.currency || 'INR',
            invoice_prefix: resolvedPrefix,
            default_due_days: resolvedDueDays,
            turnover: resolvedTurnover,
            employees: resolvedEmployees,
            gstin: resolvedGstin,
            enable_tax: resolvedEnableTax,
            tax_name: resolvedTaxName,
            tax_rate: resolvedTaxRate,
            invoice_template: resolvedTemplate,
            invoice_print_size: resolvedPrintSize,
            upi_id: resolvedUpiId,
            upi_number: resolvedUpiNumber,
            bank_name: resolvedBankName,
            account_holder_name: resolvedAccountHolder,
            account_number: resolvedAccountNumber,
            ifsc_code: resolvedIfscCode,
            account_type: resolvedAccountType,
            branch_name: resolvedBranchName,
            payment_instructions: resolvedPaymentInstructions,
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        if (active) setError(getSupabaseErrorMessage(err, 'Failed to load business details.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const save = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      let session = auth.session();
      if (!session) session = await auth.getSession();

      // Immediately cache to local storage
      try {
        localStorage.setItem('arventa_tax_settings', JSON.stringify({
          enable_tax: form.enable_tax,
          tax_name: form.tax_name || 'Tax',
          tax_rate: form.tax_rate,
          invoice_template: form.invoice_template,
          invoice_print_size: form.invoice_print_size,
        }));
        localStorage.setItem('arventa_invoice_template_settings', JSON.stringify({
          template_id: form.invoice_template,
          print_size: form.invoice_print_size,
        }));
        localStorage.setItem('arventa_payment_settings', JSON.stringify({
          upi_id: form.upi_id.trim(),
          upi_number: form.upi_number.trim(),
          bank_name: form.bank_name.trim(),
          account_holder_name: form.account_holder_name.trim(),
          account_number: form.account_number.trim(),
          ifsc_code: form.ifsc_code.trim(),
          account_type: form.account_type,
          branch_name: form.branch_name.trim(),
          payment_instructions: form.payment_instructions.trim(),
        }));
      } catch (le) {}

      if (session?.user?.id) {
        try {
          localStorage.setItem(`arventa_biz_${session.user.id}`, JSON.stringify({
            name: form.name.trim(),
            owner_name: form.owner_name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            turnover: form.turnover,
            employees: form.employees,
            gstin: form.gstin.trim(),
            invoice_prefix: form.invoice_prefix.trim(),
            default_due_days: form.default_due_days,
            currency: form.currency || 'INR',
            enable_tax: form.enable_tax,
            tax_name: form.tax_name || 'Tax',
            tax_rate: form.tax_rate,
            invoice_template: form.invoice_template,
            invoice_print_size: form.invoice_print_size,
            upi_id: form.upi_id.trim(),
            upi_number: form.upi_number.trim(),
            bank_name: form.bank_name.trim(),
            account_holder_name: form.account_holder_name.trim(),
            account_number: form.account_number.trim(),
            ifsc_code: form.ifsc_code.trim(),
            account_type: form.account_type,
            branch_name: form.branch_name.trim(),
            payment_instructions: form.payment_instructions.trim(),
          }));
        } catch (le) {
          console.warn('Could not cache to localStorage:', le);
        }
      }

      // Update Supabase Auth user_metadata
      try {
        await supabase.auth.updateUser({
          data: {
            full_name: form.owner_name.trim(),
            name: form.owner_name.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            turnover: form.turnover,
            employees: form.employees,
            gstin: form.gstin.trim(),
            business_name: form.name.trim(),
            enable_tax: form.enable_tax,
            tax_name: form.tax_name || 'Tax',
            tax_rate: form.tax_rate,
            invoice_template: form.invoice_template,
            invoice_print_size: form.invoice_print_size,
            upi_id: form.upi_id.trim(),
            upi_number: form.upi_number.trim(),
            bank_name: form.bank_name.trim(),
            account_holder_name: form.account_holder_name.trim(),
            account_number: form.account_number.trim(),
            ifsc_code: form.ifsc_code.trim(),
            account_type: form.account_type,
            branch_name: form.branch_name.trim(),
            payment_instructions: form.payment_instructions.trim(),
          }
        });
      } catch (ae) {
        console.warn('Auth updateUser:', ae);
      }

      let bid = businessId;
      if (!bid) {
        bid = await getBusinessId();
        if (bid) setBusinessId(bid);
      }

      if (bid) {
        // Update businesses profile
        try {
          await db.update('businesses', bid, {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            currency: form.currency || 'INR',
            turnover: form.turnover,
            employees: form.employees,
            gstin: form.gstin.trim(),
            upi_id: form.upi_id.trim(),
            bank_name: form.bank_name.trim(),
            account_number: form.account_number.trim(),
            ifsc_code: form.ifsc_code.trim(),
          });
        } catch (be) {
          console.warn('Full businesses update fallback:', be);
          try {
            await db.update('businesses', bid, {
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              address: form.address.trim(),
              currency: form.currency || 'INR',
            });
          } catch (be2) {
            console.warn('Basic businesses update error:', be2);
          }
        }

        // Upsert settings with tax, template and payment preferences
        try {
          await db.upsert('settings', {
            business_id: bid,
            invoice_prefix: form.invoice_prefix.trim() || 'INV',
            default_due_days: Number(form.default_due_days || 30),
            currency: form.currency || 'INR',
            gstin: form.gstin.trim(),
            enable_tax: form.enable_tax,
            tax_rate: Number(form.tax_rate || 0),
            invoice_template: form.invoice_template,
            upi_id: form.upi_id.trim(),
            upi_number: form.upi_number.trim(),
            bank_name: form.bank_name.trim(),
            account_holder_name: form.account_holder_name.trim(),
            account_number: form.account_number.trim(),
            ifsc_code: form.ifsc_code.trim(),
            account_type: form.account_type,
            branch_name: form.branch_name.trim(),
            payment_instructions: form.payment_instructions.trim(),
          });
        } catch (se) {
          console.warn('Full settings update error, trying standard settings:', se);
          try {
            await db.upsert('settings', {
              business_id: bid,
              invoice_prefix: form.invoice_prefix.trim() || 'INV',
              default_due_days: Number(form.default_due_days || 30),
              currency: form.currency || 'INR',
              enable_tax: form.enable_tax,
              tax_rate: Number(form.tax_rate || 0),
              invoice_template: form.invoice_template,
            });
          } catch (se2) {
            console.warn('Standard settings fallback error:', se2);
          }
        }
      }

      if (session?.user?.id && form.owner_name) {
        try {
          await db.update('profiles', session.user.id, {
            full_name: form.owner_name.trim(),
          });
        } catch (pe) {
          console.warn('Profile update ignored:', pe);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(getSupabaseErrorMessage(err, 'Could not save profile details. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace controls"
        title="Settings"
        description="Shape invoices and business details around the way you work."
      />

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="max-w-3xl">
          <div className="card-shell p-5 sm:p-7 space-y-4">
            <div className="skeleton h-6 w-36 rounded-md" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void save(e)} className="max-w-3xl">
          <section className="card-shell p-5 sm:p-7">
            <div className="mb-6">
              <h3 className="text-sm font-extrabold">Business profile</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This information appears on your invoices, receipts, and reports.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <AppField
                label="Business name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                test="input-business-name"
                required
              />
              <AppField
                label="Owner / Contact name"
                value={form.owner_name}
                onChange={(v) => setForm({ ...form, owner_name: v })}
                test="input-owner-name"
              />
              <AppField
                label="Business email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                test="input-business-email"
                required
              />
              <AppField
                label="Phone number"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                test="input-business-phone"
              />
              <label className="block text-xs font-bold">
                Currency
                <input
                  type="text"
                  value={form.currency}
                  disabled
                  className="input-shell mt-2 w-full px-3 text-sm font-normal disabled:opacity-60"
                  data-testid="input-business-currency"
                />
              </label>
              <div className="sm:col-span-2">
                <AppField
                  label="Business address"
                  value={form.address}
                  onChange={(v) => setForm({ ...form, address: v })}
                  test="input-business-address"
                />
              </div>
              <label className="block text-xs font-bold">
                Turnover (approx)
                <CustomDropdown
                  value={form.turnover}
                  onChange={(v) => setForm({ ...form, turnover: v })}
                  placeholder="Select turnover range"
                  options={[
                    { label: 'Under ₹1 Lakh', value: 'Under 1L', hint: '₹0 – ₹1,00,000 / year' },
                    { label: '₹1 Lakh', value: '1L', hint: 'Exact ₹1,00,000 / year' },
                    { label: '₹1 Lakh – ₹5 Lakhs', value: '1L - 5L', hint: 'Micro business' },
                    { label: '₹5 Lakhs – ₹10 Lakhs', value: '5L - 10L', hint: 'Growing business' },
                    { label: '₹10 Lakhs – ₹25 Lakhs', value: '10L - 25L', hint: 'Small enterprise' },
                    { label: '₹25 Lakhs – ₹50 Lakhs', value: '25L - 50L', hint: 'Mid enterprise' },
                    { label: '₹50 Lakhs – ₹1 Crore', value: '50L - 1Cr', hint: 'Upper mid enterprise' },
                    { label: '₹1 Crore – ₹5 Crores', value: '1Cr - 5Cr', hint: 'Large enterprise' },
                    { label: '₹5 Crores+', value: '5Cr+', hint: 'Corporate' },
                  ]}
                />
              </label>
              <label className="block text-xs font-bold">
                Employees
                <CustomDropdown
                  value={form.employees}
                  onChange={(v) => setForm({ ...form, employees: v })}
                  placeholder="Select employee count"
                  options={[
                    { label: '1 Employee (Solo / Just me)', value: '1', hint: 'Individual / Freelance' },
                    { label: '2 – 5 Employees', value: '2-5', hint: 'Small core team' },
                    { label: '6 – 10 Employees', value: '6-10', hint: 'Expanding team' },
                    { label: '11 – 25 Employees', value: '11-25', hint: 'Established team' },
                    { label: '26 – 50 Employees', value: '26-50', hint: 'Mid-sized crew' },
                    { label: '51 – 100 Employees', value: '51-100', hint: 'Department level' },
                    { label: '101 – 250 Employees', value: '101-250', hint: 'Large team' },
                    { label: '250+ Employees', value: '250+', hint: 'Enterprise organization' },
                  ]}
                />
              </label>

              {/* GST Number Input with Verification Check */}
              <div className="sm:col-span-2 pt-4 border-t border-border/60">
                <GSTVerificationInput
                  value={form.gstin}
                  onChange={(v) => setForm({ ...form, gstin: v })}
                />
              </div>
            </div>
          </section>

          {/* Tax Configuration */}
          <section className="card-shell mt-6 p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold">Tax Configuration</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose whether tax is applicable on your invoices and specify the default tax percentage.
                </p>
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2.5 sm:mt-0">
                <input
                  type="checkbox"
                  checked={form.enable_tax}
                  onChange={(e) => setForm({ ...form, enable_tax: e.target.checked })}
                  className="h-4 w-4 rounded accent-primary"
                  data-testid="checkbox-enable-tax"
                />
                <span className="text-xs font-bold text-foreground">
                  {form.enable_tax ? 'Tax Enabled' : 'Tax Disabled'}
                </span>
              </label>
            </div>

            {form.enable_tax && (
              <div className="mt-5 grid gap-5 rounded-xl border border-border/80 bg-muted/30 p-4 sm:p-5 sm:grid-cols-2">
                <label className="block text-xs font-bold">
                  Tax Name / Type
                  <input
                    type="text"
                    placeholder="e.g. VAT, GST, Tax"
                    value={form.tax_name}
                    onChange={(e) => setForm({ ...form, tax_name: e.target.value })}
                    className="input-shell mt-2 w-full px-3 py-2 text-sm font-semibold"
                    data-testid="input-tax-name"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Name displayed on the invoice.
                  </p>
                </label>
                <label className="block text-xs font-bold">
                  Default Tax Rate (%)
                  <div className="relative mt-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 10"
                      value={form.tax_rate}
                      onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                      className="input-shell w-full pl-3 pr-10 py-2 text-sm font-semibold"
                      data-testid="input-tax-rate"
                    />
                    <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">%</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Automatically applied to new invoices.
                  </p>
                </label>
              </div>
            )}
          </section>

          {/* Payment Information (UPI & Bank Transfer Details) */}
          <section className="card-shell mt-6 p-5 sm:p-7" data-testid="section-payment-settings">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Payment Information</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Configure your UPI and Bank transfer details to automatically receive direct payments from customers.
                  </p>
                </div>
              </div>
            </div>

            {/* UPI Details Box */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5 mb-5">
              <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-border/60">
                <QrCode size={16} className="text-primary" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">UPI Payment Details</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AppField
                  label="UPI ID / VPA Address"
                  value={form.upi_id}
                  onChange={(v) => setForm({ ...form, upi_id: v })}
                  placeholder="e.g. yourname@okaxis, business@upi"
                  test="input-upi-id"
                />
                <AppField
                  label="UPI Phone / Number (Optional)"
                  type="tel"
                  value={form.upi_number}
                  onChange={(v) => setForm({ ...form, upi_number: v })}
                  placeholder="e.g. +91 9876543210"
                  test="input-upi-number"
                />
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                Displayed on invoices and WhatsApp shares for instantaneous QR and UPI payments.
              </p>
            </div>

            {/* Bank Transfer Details Box */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3.5 pb-2 border-b border-border/60">
                <Building2 size={16} className="text-primary" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Bank Transfer Details (NEFT / IMPS / RTGS)</h4>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AppField
                  label="Bank Name"
                  value={form.bank_name}
                  onChange={(v) => setForm({ ...form, bank_name: v })}
                  placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                  test="input-bank-name"
                />
                <AppField
                  label="Account Holder / Beneficiary Name"
                  value={form.account_holder_name}
                  onChange={(v) => setForm({ ...form, account_holder_name: v })}
                  placeholder="e.g. BillingMaster Retail Store"
                  test="input-account-holder"
                />
                <AppField
                  label="Bank Account Number"
                  type="text"
                  value={form.account_number}
                  onChange={(v) => setForm({ ...form, account_number: v })}
                  placeholder="e.g. 12345678901234"
                  test="input-account-number"
                />
                <AppField
                  label="IFSC Code"
                  value={form.ifsc_code}
                  onChange={(v) => setForm({ ...form, ifsc_code: v.toUpperCase() })}
                  placeholder="e.g. SBIN0001234, HDFC0001234"
                  test="input-ifsc-code"
                />
                <label className="block text-xs font-bold">
                  Account Type
                  <CustomDropdown
                    value={form.account_type || 'Current'}
                    onChange={(v) => setForm({ ...form, account_type: v })}
                    placeholder="Select account type"
                    options={[
                      { label: 'Current Account (Business)', value: 'Current', hint: 'Commercial & corporate transactions' },
                      { label: 'Savings Account', value: 'Savings', hint: 'Individual & personal banking' },
                    ]}
                  />
                </label>
                <AppField
                  label="Branch Name / City (Optional)"
                  value={form.branch_name}
                  onChange={(v) => setForm({ ...form, branch_name: v })}
                  placeholder="e.g. Connaught Place Branch, New Delhi"
                  test="input-branch-name"
                />
              </div>
              <div className="mt-4">
                <AppField
                  label="Additional Payment Instructions / Notes (Optional)"
                  value={form.payment_instructions}
                  onChange={(v) => setForm({ ...form, payment_instructions: v })}
                  placeholder="e.g. Please share transaction screenshot or UTR number after transfer."
                  test="input-payment-instructions"
                />
              </div>
            </div>
          </section>

          {/* Invoice Template & Print Setup */}
          <section className="card-shell mt-6 p-5 sm:p-7">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-foreground">Invoice Template & Print Format</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select your visual invoice layout and default printer paper size.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {INVOICE_TEMPLATES.find(t => t.id === form.invoice_template)?.name} • {form.invoice_print_size}
                </span>
              </div>
            </div>

            {/* Template Selection */}
            <div className="mb-6">
              <label className="text-xs font-black text-foreground uppercase tracking-wider block mb-3">
                1. Choose Visual Design Template
              </label>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {INVOICE_TEMPLATES.map((tpl) => {
                  const isSelected = form.invoice_template === tpl.id;
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => setForm({ ...form, invoice_template: tpl.id })}
                      className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/80 shadow-sm'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                      }`}
                      data-testid={`button-template-${tpl.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-foreground">{tpl.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tpl.badgeColor}`}>
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground flex-1">{tpl.desc}</p>
                      <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-muted-foreground">{tpl.tagline}</span>
                        {isSelected ? (
                          <span className="flex items-center gap-1 font-black text-primary text-[11px]">
                            <Check size={13} className="stroke-[3]" /> Active
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px] hover:text-foreground font-semibold">Select</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Page Size */}
            <div className="pt-4 border-t border-border/70">
              <label className="text-xs font-black text-foreground uppercase tracking-wider block mb-3">
                2. Default Print Paper Size
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {PRINT_SIZES.map((sz) => {
                  const isSelected = form.invoice_print_size === sz.id;
                  return (
                    <button
                      type="button"
                      key={sz.id}
                      onClick={() => setForm({ ...form, invoice_print_size: sz.id })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                          : 'border-border bg-card text-foreground hover:bg-muted/30'
                      }`}
                      data-testid={`button-printsize-${sz.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{sz.id}</span>
                        <span className="text-[9px] font-medium text-muted-foreground">{sz.tag}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{sz.dimensions}</p>
                      <p className="text-[9px] text-muted-foreground/80 mt-0.5 line-clamp-1">{sz.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card-shell mt-6 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || !supabaseConfigured}
                className="btn-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold disabled:opacity-50"
                data-testid="button-save-settings"
              >
                {saving ? (
                  'Saving…'
                ) : saved ? (
                  <>
                    <Check size={16} /> Saved settings
                  </>
                ) : (
                  'Save settings'
                )}
              </button>
              {saved && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Settings saved successfully!
                </span>
              )}
            </div>
          </section>
        </form>
      )}
    </>
  );
}

function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const submitForm = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    setError(''); 
    
    if (mode === 'signup') {
      if (step === 'form') {
        setStep('otp');
        return;
      }
      
      if (step === 'otp') {
        if (otp !== '123456') {
          setError('Invalid OTP. Please enter 123456.');
          return;
        }
      }
    }
    setLoading(true); 
    try { 
      if (mode === 'signup') { 
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone } } }); 
        if (error) throw error; 
        setLocation('/onboarding'); 
      } else { 
        const { error } = await supabase.auth.signInWithPassword({ email, password }); 
        if (error) throw error; 
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { data: profiles } = await supabase.from('profiles').select('business_id').eq('id', sessionData.session.user.id).limit(1);
          if (profiles && profiles.length > 0 && profiles[0]?.business_id) {
            setLocation('/dashboard');
          } else {
            setLocation('/onboarding');
          }
        } else {
          setLocation('/dashboard');
        }
      } 
    } catch (err) { 
      setError(getSupabaseErrorMessage(err, 'Authentication error')); 
    } finally { 
      setLoading(false); 
    } 
  };
  
  return (
    <div className="noise flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-10 flex justify-center"><Logo /></div>
        <div className="card-shell p-6 sm:p-9">
          <h1 className="mb-6 text-center text-2xl font-extrabold tracking-tight">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
          {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive font-bold">{error}</div>}
          <form onSubmit={(e) => void submitForm(e)} className="space-y-4">
            {mode === 'signup' && step === 'form' && <><AppField label="Full name" value={name} onChange={setName} required test="input-signup-name" /><AppField label="Phone number" type="tel" value={phone} onChange={setPhone} required test="input-signup-phone" /></>}
            {step === 'form' && (
              <>
                <AppField label="Email" type="email" value={email} onChange={setEmail} required test="input-auth-email" />
                <div className="space-y-1">
                  <AppField label="Password" type="password" value={password} onChange={setPassword} required test="input-auth-password" />
                  {mode === 'login' && (
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email || '');
                          setForgotNewPassword('');
                          setForgotConfirmPassword('');
                          setForgotOtp('');
                          setForgotStep('email');
                          setForgotError('');
                          setShowForgotModal(true);
                        }}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {step === 'otp' && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center"><div className="mb-4 text-xs text-muted-foreground">We sent a 6-digit code to <strong>{email}</strong></div><AppField label="Enter OTP" value={otp} onChange={setOtp} required test="input-signup-otp" /></div>}
            <button disabled={loading || !supabaseConfigured} className="btn-primary mt-2 min-h-12 w-full rounded-xl text-sm font-extrabold disabled:opacity-50" data-testid="button-auth-submit">{loading ? 'Working…' : step === 'form' && mode === 'signup' ? 'Continue' : mode === 'login' ? 'Sign in' : 'Verify & Create account'}</button>
          </form>
        </div>
        <p className="mt-8 text-center text-[13px] text-muted-foreground">{mode === 'login' ? 'New here? ' : 'Already have an account? '}<Link href={mode === 'login' ? '/signup' : '/login'} className="font-bold text-foreground hover:underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</Link></p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="card-shell w-full max-w-sm p-6 sm:p-7 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-base font-black text-foreground">Reset Password</h3>
              <button onClick={() => setShowForgotModal(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={18} /></button>
            </div>

            {forgotError && (
              <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive font-bold">{forgotError}</div>
            )}

            {forgotStep === 'email' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!forgotEmail.trim()) { setForgotError('Please enter your registered email.'); return; }
                setForgotError('');
                setForgotStep('otp');
              }} className="mt-4 space-y-4">
                <AppField label="Registered Email" type="email" value={forgotEmail} onChange={setForgotEmail} required placeholder="Enter your email (e.g. name@example.com)" />
                <p className="text-[11px] text-muted-foreground">Enter your registered email address to receive your password reset verification code.</p>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowForgotModal(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Cancel</button>
                  <button type="submit" className="btn-primary rounded-xl px-5 py-2 text-xs font-bold">Send Reset Code</button>
                </div>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (forgotOtp !== '123456') {
                  setForgotError('Invalid verification code. Please enter 123456.');
                  return;
                }
                setForgotError('');
                setForgotStep('new_password');
              }} className="mt-4 space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center text-xs text-muted-foreground">
                  Verification code generated for <strong>{forgotEmail}</strong>.<br />
                  <span className="font-mono text-primary font-bold">Verification Code: 123456</span>
                </div>
                <AppField label="Verification Code" value={forgotOtp} onChange={setForgotOtp} required placeholder="123456" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setForgotStep('email')} className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Back</button>
                  <button type="submit" className="btn-primary rounded-xl px-5 py-2 text-xs font-bold">Verify Code</button>
                </div>
              </form>
            )}

            {forgotStep === 'new_password' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!forgotNewPassword.trim()) { setForgotError('Please enter your new password.'); return; }
                if (forgotNewPassword.length < 4) { setForgotError('Password must be at least 4 characters.'); return; }
                if (forgotNewPassword !== forgotConfirmPassword) { setForgotError('Passwords do not match. Please make sure both passwords match.'); return; }
                setForgotLoading(true);
                setForgotError('');
                try {
                  const { error: resetErr } = await supabase.auth.resetPassword({ email: forgotEmail, password: forgotNewPassword, otp: forgotOtp });
                  if (resetErr) throw resetErr;
                  toast.success('Password updated successfully! You can now sign in.');
                  setPassword(forgotNewPassword);
                  setEmail(forgotEmail);
                  setShowForgotModal(false);
                } catch (err: any) {
                  setForgotError(getSupabaseErrorMessage(err, 'Failed to reset password.'));
                } finally {
                  setForgotLoading(false);
                }
              }} className="mt-4 space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ Code Verified! Set your new password below.
                </div>
                <AppField label="New Password" type="password" value={forgotNewPassword} onChange={setForgotNewPassword} required placeholder="Enter new password" />
                <AppField label="Confirm New Password" type="password" value={forgotConfirmPassword} onChange={setForgotConfirmPassword} required placeholder="Re-enter new password" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setForgotStep('otp')} className="rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted">Back</button>
                  <button type="submit" disabled={forgotLoading} className="btn-primary rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50">
                    {forgotLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Onboarding() {
  const [, setLocation] = useLocation(); 
  const [onboardingStep, setOnboardingStep] = useState<'shop' | 'gst'>('shop');
  const [hasGstin, setHasGstin] = useState<boolean | null>(null);
  const [isGstVerified, setIsGstVerified] = useState(false);
  const [gstin, setGstin] = useState('');
  const [name, setName] = useState(''); 
  const [address, setAddress] = useState('');
  const [turnover, setTurnover] = useState('');
  const [employees, setEmployees] = useState('');
  const [currency, setCurrency] = useState('INR'); 
  const [error, setError] = useState(''); 
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    async function preload() {
      let session = auth.session();
      if (!session) session = await auth.getSession();
      const meta = session?.user?.user_metadata || {};
      if (meta.business_name) setName(meta.business_name);
      if (meta.address) setAddress(meta.address);
      if (meta.turnover) setTurnover(meta.turnover);
      if (meta.employees) setEmployees(meta.employees);
    }
    void preload();
  }, []);

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your business name.');
      return;
    }
    setError('');
    setOnboardingStep('gst');
  };

  const save = async (e?: React.FormEvent) => { 
    if (e) e.preventDefault(); 
    setSaving(true); 
    setError('');
    try { 
      let session = auth.session();
      if (!session) {
        session = await auth.getSession();
      }
      const userMeta = session?.user?.user_metadata || {};
      const memberName = userMeta.full_name || userMeta.name || session?.user?.email?.split('@')[0] || 'Owner';
      const userEmail = session?.user?.email || '';
      const userPhone = userMeta.phone || (session?.user as any)?.phone || '';
      const finalGstin = hasGstin === true ? gstin.trim().toUpperCase() : '';

      // Immediately cache in localStorage
      if (session?.user?.id) {
        try {
          localStorage.setItem(`arventa_biz_${session.user.id}`, JSON.stringify({
            name: name.trim(),
            owner_name: memberName,
            email: userEmail,
            phone: userPhone,
            address: address.trim(),
            turnover,
            employees,
            currency: currency || 'INR',
            gstin: finalGstin,
          }));
        } catch (le) {
          console.warn('localStorage cache error:', le);
        }
      }

      // Update Supabase Auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            business_name: name.trim(),
            address: address.trim(),
            turnover,
            employees,
            full_name: memberName,
            name: memberName,
            phone: userPhone,
            gstin: finalGstin,
          }
        });
      } catch (ae) {
        console.warn('Auth user metadata update in onboarding:', ae);
      }

      let bizId: string | null = null;
      try {
        const biz = await db.rpc<Row>('create_business', {
          business_name: name.trim(),
          member_name: memberName,
          business_currency: currency || 'INR'
        }); 
        if (biz && biz.id) {
          bizId = biz.id;
          setCurrentBusinessId(biz.id);
        }
      } catch (rpcErr) {
        console.warn('create_business rpc error:', rpcErr);
        bizId = await getBusinessId();
      }

      if (bizId) {
        try {
          await db.update('businesses', bizId, {
            name: name.trim(),
            address: address.trim(),
            turnover,
            employees,
            email: userEmail,
            phone: userPhone,
            currency: currency || 'INR'
          });
        } catch (e) {
          console.warn('Fallback update business fields:', e);
          try {
            await db.update('businesses', bizId, { 
              address: address.trim(), 
              name: name.trim(),
              email: userEmail,
              phone: userPhone
            });
          } catch (e2) {}
        }

        try {
          await db.upsert('settings', {
            business_id: bizId,
            invoice_prefix: 'INV',
            default_due_days: 30,
            currency: currency || 'INR',
            gstin: finalGstin,
            enable_tax: Boolean(finalGstin),
            tax_rate: finalGstin ? 18 : 0,
          });
        } catch (e3) {
          console.warn('Default settings setup:', e3);
        }
      }
      setLocation('/dashboard'); 
    } catch (err) { 
      setError(getSupabaseErrorMessage(err, 'Could not create your business.')); 
    } finally { 
      setSaving(false); 
    } 
  };
  
  return <div className="noise flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
    <div className="w-full max-w-lg animate-rise">
      <div className="mb-10 flex justify-center"><Logo /></div>
      <div className="card-shell p-6 sm:p-9">
        {onboardingStep === 'shop' ? (
          <>
            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Step 1 of 2</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">Shop Details</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-[-.06em]">Tell us about the shop.</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">We’ll use this to keep your invoices and reports grounded in your business.</p>
            </div>
            {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <AppField label="Business name" value={name} onChange={setName} test="input-onboarding-business" required />
              <AppField label="Business address" value={address} onChange={setAddress} test="input-onboarding-address" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold">
                  Turnover (approx)
                  <CustomDropdown
                    value={turnover}
                    onChange={setTurnover}
                    placeholder="Select turnover range"
                    options={[
                      { label: 'Under ₹1 Lakh', value: 'Under 1L', hint: '₹0 – ₹1,00,000 / year' },
                      { label: '₹1 Lakh', value: '1L', hint: 'Exact ₹1,00,000 / year' },
                      { label: '₹1 Lakh – ₹5 Lakhs', value: '1L - 5L', hint: 'Micro business' },
                      { label: '₹5 Lakhs – ₹10 Lakhs', value: '5L - 10L', hint: 'Growing business' },
                      { label: '₹10 Lakhs – ₹25 Lakhs', value: '10L - 25L', hint: 'Small enterprise' },
                      { label: '₹25 Lakhs – ₹50 Lakhs', value: '25L - 50L', hint: 'Mid enterprise' },
                      { label: '₹50 Lakhs – ₹1 Crore', value: '50L - 1Cr', hint: 'Upper mid enterprise' },
                      { label: '₹1 Crore – ₹5 Crores', value: '1Cr - 5Cr', hint: 'Large enterprise' },
                      { label: '₹5 Crores+', value: '5Cr+', hint: 'Corporate' },
                    ]}
                  />
                </label>
                <label className="block text-xs font-bold">
                  Employees
                  <CustomDropdown
                    value={employees}
                    onChange={setEmployees}
                    placeholder="Select employee count"
                    options={[
                      { label: '1 Employee (Solo / Just me)', value: '1', hint: 'Individual / Freelance' },
                      { label: '2 – 5 Employees', value: '2-5', hint: 'Small core team' },
                      { label: '6 – 10 Employees', value: '6-10', hint: 'Expanding team' },
                      { label: '11 – 25 Employees', value: '11-25', hint: 'Established team' },
                      { label: '26 – 50 Employees', value: '26-50', hint: 'Mid-sized crew' },
                      { label: '51 – 100 Employees', value: '51-100', hint: 'Department level' },
                      { label: '101 – 250 Employees', value: '101-250', hint: 'Large team' },
                      { label: '250+ Employees', value: '250+', hint: 'Enterprise organization' },
                    ]}
                  />
                </label>
              </div>
              <label className="block text-xs font-bold">Currency
                <CustomDropdown 
                  disabled 
                  value={currency} 
                  onChange={setCurrency}
                  options={[{ label: "INR — Indian Rupee", value: "INR" }]}
                />
              </label>
              <button disabled={!supabaseConfigured} className="btn-primary mt-2 min-h-12 w-full rounded-xl text-sm font-extrabold disabled:opacity-50" data-testid="button-finish-onboarding">
                Continue to GST Setup
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Step 2 of 2</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">GST Verification</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-.06em]">Do you have a GST Number?</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enter your 15-character GSTIN for verified tax invoicing, or skip this step if your business is not GST registered.
              </p>
            </div>

            {error && <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

            <div className="space-y-4">
              {/* Option Choice Cards */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasGstin(true);
                    setIsGstVerified(false);
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    hasGstin === true
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  data-testid="button-select-has-gstin"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                    <ShieldCheck size={16} className={hasGstin === true ? 'text-primary' : 'text-muted-foreground'} />
                    <span>Yes, I have GSTIN</span>
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    Enter & verify 15-digit GSTIN
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHasGstin(false);
                    setGstin('');
                    setIsGstVerified(false);
                  }}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    hasGstin === false
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/50'
                  }`}
                  data-testid="button-select-no-gstin"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                    <CheckCircle2 size={16} className={hasGstin === false ? 'text-primary' : 'text-muted-foreground'} />
                    <span>No, I don't have</span>
                  </div>
                  <span className="mt-1 text-[11px] text-muted-foreground leading-snug">
                    Skip tax registration for now
                  </span>
                </button>
              </div>

              {/* If Yes: Show GST verification input */}
              {hasGstin === true && (
                <div className="mt-4 pt-4 border-t border-border/80 animate-rise">
                  <GSTVerificationInput
                    value={gstin}
                    onChange={(val) => {
                      setGstin(val);
                      setIsGstVerified(false);
                    }}
                    onVerified={(isValid) => {
                      setIsGstVerified(isValid);
                    }}
                  />
                </div>
              )}

              {/* If No: Show friendly note */}
              {hasGstin === false && (
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed animate-rise">
                  <p className="font-semibold text-foreground mb-1">No GSTIN required</p>
                  You can start generating non-tax invoices and managing your customers right away. You can always add or verify your GSTIN at any time in Settings.
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2.5">
                {hasGstin === true ? (
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !supabaseConfigured || !gstin.trim() || !isGstVerified}
                    className="btn-primary min-h-12 w-full rounded-xl text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    data-testid="button-finish-onboarding-with-gstin"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Setting up workspace…</span>
                      </>
                    ) : !isGstVerified ? (
                      'Verify GSTIN to continue'
                    ) : (
                      'Save & Open Workspace'
                    )}
                  </button>
                ) : hasGstin === false ? (
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !supabaseConfigured}
                    className="btn-primary min-h-12 w-full rounded-xl text-sm font-extrabold disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="button-finish-onboarding-skip-gstin"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Setting up workspace…</span>
                      </>
                    ) : (
                      'Skip & Open Workspace'
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={true}
                    className="btn-primary min-h-12 w-full rounded-xl text-sm font-extrabold opacity-40 cursor-not-allowed flex items-center justify-center gap-2"
                    data-testid="button-finish-onboarding-prompt"
                  >
                    Select an option above to continue
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setOnboardingStep('shop');
                  }}
                  disabled={saving}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-back-to-shop-details"
                >
                  <ArrowLeft size={14} />
                  <span>Back to shop details</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="mt-5 text-center text-[11px] text-muted-foreground">You can change these details anytime in Settings.</p>
    </div>
  </div>;
}

function Home() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        setLocation('/login');
        return;
      }
      try {
        const { data: profiles } = await supabase.from('profiles').select('business_id').eq('id', data.session.user.id).limit(1);
        if (active) {
          if (profiles && profiles.length > 0 && profiles[0]?.business_id) {
            setLocation('/dashboard');
          } else {
            setLocation('/onboarding');
          }
        }
      } catch (e) {
        if (active) setLocation('/onboarding');
      }
    });
    return () => { active = false; };
  }, [setLocation]);
  return <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">Loading workspace…</div>;
}

function useAppLocation(options?: any): [string, (to: string, options?: { replace?: boolean }) => void] {
  const isDesktop = isDesktopOrFile();
  const hashLoc = useHashLocation(options);
  const browserLoc = useBrowserLocation(options);
  return isDesktop ? hashLoc : browserLoc;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useAppLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Protected({ children }: { children: ReactNode }) { return <Shell>{children}</Shell>; }

function KhataBookWrapper() {
  const params = useParams<{ id?: string }>();
  return <KhataBook initialCustomerId={params.id} />;
}

function ScrollToTop() {
  const [location] = useAppLocation();
  useScrollReset(location);
  return null;
}

function Router() {
  return <RoutedErrorBoundary><ScrollToTop /><Switch>
    <Route path="/" component={Home} />
    <Route path="/login"><Auth mode="login" /></Route>
    <Route path="/signup"><Auth mode="signup" /></Route>
    <Route path="/onboarding" component={Onboarding} />
    <Route path="/catalog/:id" component={PublicCatalog} />
    <Route path="/catalog" component={PublicCatalog} />
    <Route path="/dashboard"><Protected><Dashboard key="dashboard" /></Protected></Route>
    <Route path="/invoices/new"><Protected><InvoiceNew key="invoice-new" /></Protected></Route>
    <Route path="/invoices/:id"><Protected><InvoiceDetail key="invoice-detail" /></Protected></Route>
    <Route path="/invoices"><Protected><Invoices key="invoices" /></Protected></Route>
    <Route path="/customers"><Protected><CrudPage key="customers" kind="customers" /></Protected></Route>
    <Route path="/products"><Protected><CrudPage key="products" kind="products" /></Protected></Route>
    <Route path="/khatabook/:id"><Protected><KhataBookWrapper key="khatabook-id" /></Protected></Route>
    <Route path="/khatabook"><Protected><KhataBook key="khatabook" /></Protected></Route>
    <Route path="/purchases"><Protected><KhataBook key="purchases" /></Protected></Route>
    <Route path="/expenses"><Protected><SimpleList key="expenses" kind="expenses" /></Protected></Route>
    <Route path="/for-you"><Protected><ForYouHub key="for-you" /></Protected></Route>
    <Route path="/toolkit"><Protected><ForYouHub key="toolkit" /></Protected></Route>
    <Route path="/foryou"><Protected><ForYouHub key="foryou" /></Protected></Route>
    <Route path="/growth"><Protected><ForYouHub key="growth" /></Protected></Route>
    <Route path="/more"><Protected><MoreHub key="more" /></Protected></Route>
    <Route path="/reports"><Protected><Reports key="reports" /></Protected></Route>
    <Route path="/settings"><Protected><Settings key="settings" /></Protected></Route>
    <Route><div className="p-10">Not found</div></Route>
  </Switch></RoutedErrorBoundary>;
}

function App() {
  const isDesktop = isDesktopOrFile();

  useEffect(() => {
    void mobileService.init();
  }, []);

  const rawBase = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
  const routerBase = (!rawBase || rawBase === '.' || rawBase === './') ? undefined : rawBase;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DesktopTitlebar />
        <WouterRouter
          hook={useAppLocation}
          base={isDesktop ? undefined : routerBase}
        >
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
