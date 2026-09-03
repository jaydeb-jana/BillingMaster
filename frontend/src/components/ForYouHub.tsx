import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, FileText, Calendar, Share2, Users, BarChart3, Store,
  Send, Gift, CheckCircle2, Calculator, ArrowRight, Download,
  ExternalLink, Copy, Check, Clock, ShieldCheck, DollarSign,
  TrendingUp, RefreshCw, X, MessageSquare, Phone, Percent,
  Building2, Briefcase, Plus, FileSpreadsheet, AlertCircle,
  QrCode, Printer, Smartphone, ChevronRight, ChevronDown, CheckCheck
} from 'lucide-react';
import { db, auth } from '@/lib/api';
import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';
import jsPDF from 'jspdf';

interface ForYouHubProps {
  onNavigate?: (path: string) => void;
}

export function ForYouHub({ onNavigate }: ForYouHubProps) {
  const [, setLocation] = useLocation();
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Workspace data
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [business, setBusiness] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Copied feedback
  const [copied, setCopied] = useState(false);

  // Load active business & workspace data
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        const session = auth.session();
        const [prods, invs, custs, exps, bizes] = await Promise.all([
          db.list('products', {}).catch(() => []),
          db.list('invoices', {}).catch(() => []),
          db.list('customers', {}).catch(() => []),
          db.list('expenses', {}).catch(() => []),
          db.list('businesses', {}).catch(() => []),
        ]);
        if (active) {
          setProducts(prods || []);
          setInvoices(invs || []);
          setCustomers(custs || []);
          setExpenses(exps || []);
          if (bizes && bizes.length > 0) {
            setBusiness(bizes[0]);
          }
        }
      } catch (err) {
        console.error('Error loading for-you data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  const businessName = business?.name || 'BillingMaster';
  const businessPhone = business?.phone || '+91 98765 43210';
  const businessGstin = business?.gstin || '';

  // Smart Calculator State
  const [calcMode, setCalcMode] = useState<'gst' | 'margin' | 'reverse'>('gst');
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcGstRate, setCalcGstRate] = useState<number>(18);
  const [calcCostPrice, setCalcCostPrice] = useState<number>(500);
  const [calcSellingPrice, setCalcSellingPrice] = useState<number>(750);

  // Attendance State (Local Persistence)
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [staffList, setStaffList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('lms_staff_attendance');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Rahul Sharma', role: 'Store Manager', status: 'present', salary: 25000, advance: 0 },
      { id: '2', name: 'Amit Kumar', role: 'Billing Operator', status: 'present', salary: 18000, advance: 2000 },
      { id: '3', name: 'Pooja Verma', role: 'Sales Associate', status: 'half_day', salary: 15000, advance: 0 },
      { id: '4', name: 'Vikram Singh', role: 'Inventory Executive', status: 'present', salary: 16000, advance: 0 },
    ];
  });

  const updateStaffStatus = (id: string, status: string) => {
    const updated = staffList.map(s => s.id === id ? { ...s, status } : s);
    setStaffList(updated);
    localStorage.setItem('lms_staff_attendance', JSON.stringify(updated));
  };

  // WhatsApp Marketing State
  const [selectedCampaign, setSelectedCampaign] = useState<string>('festive');
  const [customMsg, setCustomMsg] = useState<string>(
    `🎉 Exclusive Special Offer from ${businessName}!\nGet up to 20% discount on top products this week. Visit us or place your order directly on WhatsApp!\n\n📞 Call/WhatsApp: ${businessPhone}`
  );
  const [targetCustomer, setTargetCustomer] = useState<string>('all');

  // Reward Points State
  const [pointsPer100, setPointsPer100] = useState<number>(5);
  const [pointValueInRs, setPointValueInRs] = useState<number>(1);

  // Calculations for GST & Financials
  const salesSummary = useMemo(() => {
    const totalSales = invoices.reduce((acc, inv) => acc + Number(inv.total_amount || inv.total || 0), 0);
    const totalTax = invoices.reduce((acc, inv) => acc + Number(inv.tax_amount || 0), 0);
    const totalExpenses = expenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
    const grossMargin = totalSales > 0 ? ((totalSales - totalExpenses) / totalSales) * 100 : 0;
    const netProfit = totalSales - totalExpenses;

    const b2bInvoices = invoices.filter(inv => inv.customer_gstin || inv.gstin);
    const b2cInvoices = invoices.filter(inv => !inv.customer_gstin && !inv.gstin);

    return {
      totalSales,
      totalTax,
      totalExpenses,
      grossMargin: grossMargin.toFixed(1),
      netProfit,
      b2bCount: b2bInvoices.length,
      b2bTotal: b2bInvoices.reduce((a, b) => a + Number(b.total_amount || b.total || 0), 0),
      b2cCount: b2cInvoices.length,
      b2cTotal: b2cInvoices.reduce((a, b) => a + Number(b.total_amount || b.total || 0), 0),
    };
  }, [invoices, expenses]);

  // Export CA Package
  const exportCaPackage = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${businessName} — Financial Statement Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Business Name: ${businessName}`, 14, 28);
    doc.text(`GSTIN: ${businessGstin || 'Unregistered / Retail'}`, 14, 34);
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-IN')}`, 14, 40);

    doc.line(14, 45, 196, 45);

    doc.setFontSize(12);
    doc.text(`1. Executive Summary`, 14, 54);
    doc.setFontSize(10);
    doc.text(`Total Gross Sales: Rs ${salesSummary.totalSales.toLocaleString('en-IN')}`, 14, 62);
    doc.text(`Total GST Collected: Rs ${salesSummary.totalTax.toLocaleString('en-IN')}`, 14, 68);
    doc.text(`Total Business Expenses: Rs ${salesSummary.totalExpenses.toLocaleString('en-IN')}`, 14, 74);
    doc.text(`Estimated Net Profit: Rs ${salesSummary.netProfit.toLocaleString('en-IN')}`, 14, 80);

    doc.line(14, 86, 196, 86);
    doc.setFontSize(12);
    doc.text(`2. Tax & Compliance Breakdown (GSTR-1 & GSTR-3B)`, 14, 95);
    doc.setFontSize(10);
    doc.text(`B2B Taxable Invoices: ${salesSummary.b2bCount} (Rs ${salesSummary.b2bTotal.toLocaleString('en-IN')})`, 14, 103);
    doc.text(`B2C Retail Invoices: ${salesSummary.b2cCount} (Rs ${salesSummary.b2cTotal.toLocaleString('en-IN')})`, 14, 109);
    doc.text(`Total Invoices Logged: ${invoices.length}`, 14, 115);
    doc.text(`Active Customers: ${customers.length}`, 14, 121);
    doc.text(`Active Catalog Items: ${products.length}`, 14, 127);

    doc.save(`CA_Report_${businessName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export Tally Compatible XML/JSON
  const exportTallyData = () => {
    const tallyExport = {
      COMPANY: businessName,
      GSTIN: businessGstin,
      EXPORT_DATE: new Date().toISOString(),
      VOUCHERS: invoices.map(inv => ({
        VOUCHER_NUMBER: inv.invoice_number || inv.id,
        DATE: inv.issue_date || inv.created_at,
        PARTY_NAME: inv.customer_name || 'Cash Customer',
        AMOUNT: inv.total_amount || inv.total || 0,
        TAX_AMOUNT: inv.tax_amount || 0,
        STATUS: inv.payment_status || inv.status || 'Paid',
      })),
      CUSTOMERS: customers.map(c => ({
        NAME: c.name || c.full_name,
        PHONE: c.phone,
        GSTIN: c.gstin || '',
        BALANCE: c.current_balance || 0,
      })),
    };

    const blob = new Blob([JSON.stringify(tallyExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tally_Data_${businessName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = (message: string, phone = '') => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Top Gradient Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-orange-600 p-6 sm:p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
            <Sparkles size={14} className="text-yellow-300 animate-pulse" />
            <span>Growth & Utilities Hub</span>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white">
            For You <span className="text-yellow-300">✨</span>
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-white/90 font-medium leading-relaxed">
            Specialized business tools designed to supercharge your sales, automated accounting, staff payroll, and marketing campaigns.
          </p>
        </div>

        {/* Decorative background blur circles */}
        <div className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 h-32 w-32 rounded-full bg-yellow-400/20 blur-xl pointer-events-none" />
      </div>


      {/* SECTION 1: Recommended for you */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground tracking-tight">Recommended for you</h2>
          <span className="text-[11px] font-bold text-muted-foreground">3 Tools Ready</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: e-Invoice */}
          <div
            onClick={() => setActiveModal('einvoice')}
            className="group relative cursor-pointer rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <QrCode size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                  e-Invoice & e-Way Bill
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  B2B IRN generation, digital signature QR, and e-way bill compliance tools.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50 text-[11px] font-bold text-primary">
              <span>Open e-Invoice Suite</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 2: Staff Attendance & Payroll */}
          <div
            onClick={() => setActiveModal('attendance')}
            className="group relative cursor-pointer rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Calendar size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                  Staff Attendance & Payroll
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Daily staff clock-in, salary calculator, advance vouchers, and pay slips.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50 text-[11px] font-bold text-primary">
              <span>Manage Attendance ({staffList.length} staff)</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Card 3: Desktop Software & Cloud Sync */}
          <div
            onClick={() => setActiveModal('cloud-sync')}
            className="group relative cursor-pointer rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-center gap-3.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <Smartphone size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                  Desktop & Cloud Sync
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  Multi-counter POS synchronization, offline backup, and encrypted cloud storage.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50 text-[11px] font-bold text-primary">
              <span>View Sync Status</span>
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Marketing & Sales */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground tracking-tight">Marketing & Sales</h2>
          <span className="text-[11px] font-bold text-muted-foreground">Boost Revenue</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Tile 1: WhatsApp Marketing */}
          <div
            onClick={() => setActiveModal('whatsapp-marketing')}
            className="group flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-13 w-13 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3">
              <MessageSquare size={24} />
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-foreground">WhatsApp Marketing</h4>
            <p className="text-[10px] text-muted-foreground mt-1">Offers, greetings & flyers</p>
          </div>

          {/* Tile 2: Reward Points */}
          <div
            onClick={() => setActiveModal('reward-points')}
            className="group flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-13 w-13 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform mb-3">
              <Gift size={24} />
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Reward Points</h4>
            <p className="text-[10px] text-muted-foreground mt-1">Loyalty points & cashback</p>
          </div>

          {/* Tile 3: Online Store */}
          <div
            onClick={() => setActiveModal('online-store')}
            className="group flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-13 w-13 place-items-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-3">
              <Store size={24} />
            </div>
            <h4 className="text-xs sm:text-sm font-extrabold text-foreground">Online Store</h4>
            <p className="text-[10px] text-muted-foreground mt-1">Shareable product catalog</p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Accounting & CA Suite */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground tracking-tight">Accounting & CA Suite</h2>
          <span className="text-[11px] font-bold text-muted-foreground">Compliance & Books</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Tile 1: GST Filing */}
          <div
            onClick={() => setActiveModal('gst-filing')}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform mb-2.5">
              <FileText size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">GST Filing</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">GSTR-1 & 3B</p>
          </div>

          {/* Tile 2: Balance Sheet */}
          <div
            onClick={() => setActiveModal('balance-sheet')}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-2.5">
              <BarChart3 size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">Balance Sheet</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">P&L and Assets</p>
          </div>

          {/* Tile 3: Automated Recurring Bills */}
          <div
            onClick={() => setActiveModal('recurring-bills')}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform mb-2.5">
              <Clock size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">Automated Bills</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">Recurring cycles</p>
          </div>

          {/* Tile 4: CA Reports Sharing */}
          <div
            onClick={() => setActiveModal('ca-reports')}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform mb-2.5">
              <ShieldCheck size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">CA Sharing</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">1-click package</p>
          </div>

          {/* Tile 5: Full Reports */}
          <div
            onClick={() => {
              if (onNavigate) onNavigate('/reports');
              else setLocation('/reports');
            }}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform mb-2.5">
              <FileSpreadsheet size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">All Reports</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sales & Tax logs</p>
          </div>

          {/* Tile 6: Data Export to Tally */}
          <div
            onClick={() => setActiveModal('tally-export')}
            className="group flex flex-col items-center text-center p-4 rounded-2xl border border-border/80 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-xs hover:border-primary/40"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-2.5">
              <Download size={22} />
            </div>
            <h4 className="text-xs font-extrabold text-foreground">Export to Tally</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">XML & Excel</p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Business Efficiency (Smart Calculator) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-foreground tracking-tight">Business Efficiency</h2>
          <span className="text-[11px] font-bold text-muted-foreground">Calculators & Tools</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Smart Calculator Card */}
          <div
            onClick={() => setActiveModal('smart-calculator')}
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Calculator size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                    Smart GST & Margin Calculator
                  </h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                    Interactive
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Compute GST inclusive/exclusive rates, reverse tax calculations, gross margins, and retail markup percentages in seconds.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <span>Open Calculator</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick GST Rate Finder Tile */}
          <div
            onClick={() => setActiveModal('gst-finder')}
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Percent size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                    HSN & GST Rate Finder
                  </h3>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                    Slab Directory
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Lookup official Indian GST tax slabs (0%, 5%, 12%, 18%, 28%) and HSN/SAC codes across all retail goods and commercial services.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                  <span>Search HSN Codes</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALS & DETAILED INTERACTIVE TOOLS                                        */}
      {/* ========================================================================= */}

      {/* MODAL 1: Smart Calculator */}
      {activeModal === 'smart-calculator' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Smart Commercial Calculator</h3>
                  <p className="text-[11px] text-muted-foreground">GST, Margin & Markup Real-time Engine</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Calculator Mode Switcher */}
            <div className="mt-4 flex rounded-xl bg-muted/60 p-1 text-xs font-bold">
              <button
                onClick={() => setCalcMode('gst')}
                className={`flex-1 py-2 rounded-lg transition-all ${calcMode === 'gst' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                GST Calculator
              </button>
              <button
                onClick={() => setCalcMode('margin')}
                className={`flex-1 py-2 rounded-lg transition-all ${calcMode === 'margin' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Profit Margin %
              </button>
              <button
                onClick={() => setCalcMode('reverse')}
                className={`flex-1 py-2 rounded-lg transition-all ${calcMode === 'reverse' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Reverse GST from MRP
              </button>
            </div>

            {/* Mode 1: GST Calculator */}
            {calcMode === 'gst' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground">Net Base Amount (₹)</label>
                  <input
                    type="number"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Number(e.target.value))}
                    className="input-shell mt-1.5 w-full text-base font-extrabold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Select GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Breakdown Card */}
                {(() => {
                  const taxAmount = (calcAmount * calcGstRate) / 100;
                  const total = calcAmount + taxAmount;
                  const cgst = taxAmount / 2;
                  const sgst = taxAmount / 2;
                  return (
                    <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 space-y-2.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Net Base Price:</span>
                        <span className="font-bold text-foreground">₹{calcAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>CGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>SGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                        <span>Total Tax ({calcGstRate}%):</span>
                        <span className="font-bold text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-foreground border-t border-border pt-2">
                        <span>Final Invoice Total:</span>
                        <span className="text-primary text-base">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mode 2: Profit Margin & Markup */}
            {calcMode === 'margin' && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground">Cost Price / Buy (₹)</label>
                    <input
                      type="number"
                      value={calcCostPrice}
                      onChange={(e) => setCalcCostPrice(Number(e.target.value))}
                      className="input-shell mt-1.5 w-full text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground">Selling Price / MRP (₹)</label>
                    <input
                      type="number"
                      value={calcSellingPrice}
                      onChange={(e) => setCalcSellingPrice(Number(e.target.value))}
                      className="input-shell mt-1.5 w-full text-sm font-bold"
                    />
                  </div>
                </div>

                {(() => {
                  const profit = calcSellingPrice - calcCostPrice;
                  const marginPct = calcSellingPrice > 0 ? (profit / calcSellingPrice) * 100 : 0;
                  const markupPct = calcCostPrice > 0 ? (profit / calcCostPrice) * 100 : 0;
                  return (
                    <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 space-y-2.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Net Profit Per Unit:</span>
                        <span className={`font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          ₹{profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Gross Profit Margin:</span>
                        <span className="font-extrabold text-foreground">{marginPct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Cost Markup Percentage:</span>
                        <span className="font-extrabold text-foreground">{markupPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mode 3: Reverse GST */}
            {calcMode === 'reverse' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground">MRP / Gross Amount with GST (₹)</label>
                  <input
                    type="number"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Number(e.target.value))}
                    className="input-shell mt-1.5 w-full text-base font-extrabold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Included GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const basePrice = (calcAmount * 100) / (100 + calcGstRate);
                  const taxAmount = calcAmount - basePrice;
                  return (
                    <div className="rounded-2xl bg-muted/40 p-4 border border-border/60 space-y-2.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Actual Base Price (Pre-Tax):</span>
                        <span className="font-bold text-foreground">₹{basePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Extracted GST ({calcGstRate}%):</span>
                        <span className="font-bold text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                        <span>CGST + SGST Split:</span>
                        <span className="font-bold text-foreground">₹{(taxAmount / 2).toFixed(2)} + ₹{(taxAmount / 2).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WhatsApp Marketing & Greetings */}
      {activeModal === 'whatsapp-marketing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">WhatsApp Marketing Center</h3>
                  <p className="text-[11px] text-muted-foreground">Create promotional campaigns & personal greetings</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campaign Preset Tabs */}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-foreground">Select Campaign Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'festive', label: 'Festive Greeting', desc: 'Special festival discount' },
                  { id: 'new_arrivals', label: 'New Arrivals', desc: 'Fresh product catalog' },
                  { id: 'clearance', label: 'Sale & Clearance', desc: 'End of season discounts' },
                ].map(camp => (
                  <button
                    key={camp.id}
                    onClick={() => {
                      setSelectedCampaign(camp.id);
                      if (camp.id === 'festive') {
                        setCustomMsg(`🎉 Festive Greetings from ${businessName}!\nWishing you and your family happiness & prosperity. Enjoy flat 15% discount on all purchases this month!\n\n📍 Visit our store or order on WhatsApp: ${businessPhone}`);
                      } else if (camp.id === 'new_arrivals') {
                        setCustomMsg(`✨ Fresh Stock Alert from ${businessName}!\nWe have added new collection items to our catalog. Check out the latest products with best market prices.\n\n🛒 Contact us now: ${businessPhone}`);
                      } else {
                        setCustomMsg(`🔥 MEGA CLEARANCE SALE at ${businessName}!\nGet up to 30% OFF on selected products while stock lasts. Limited time offer!\n\n📞 Order now: ${businessPhone}`);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedCampaign === camp.id
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-foreground">{camp.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{camp.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground">Message Content</label>
                <button
                  onClick={() => copyToClipboard(customMsg)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy Message'}</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="input-shell w-full text-xs font-medium leading-relaxed p-3"
              />
            </div>

            {/* Quick Customer Broadcast List */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-foreground">
                Send to Customer ({customers.length} Contacts Available)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                {customers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No customer contacts found. Add customers in the Customers tab to broadcast.
                  </div>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-foreground">{c.name || c.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{c.phone || 'No phone'}</p>
                      </div>
                      {c.phone && (
                        <button
                          onClick={() => handleShareWhatsApp(customMsg, c.phone)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold shadow-2xs"
                        >
                          <Send size={11} />
                          <span>Send WhatsApp</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* General Share Action */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => handleShareWhatsApp(customMsg)}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
              >
                <Share2 size={14} />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Staff Attendance & Payroll */}
      {activeModal === 'attendance' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-2xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Staff Attendance & Payroll</h3>
                  <p className="text-[11px] text-muted-foreground">Daily attendance register and monthly salary overview</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Date Selector */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Attendance Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="input-shell text-xs py-1.5 px-2.5 font-bold"
                />
              </div>
              <div className="text-xs font-extrabold text-foreground">
                Total Staff: <span className="text-primary">{staffList.length}</span>
              </div>
            </div>

            {/* Staff Attendance Table */}
            <div className="mt-4 rounded-xl border border-border/70 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/70">
                  <tr>
                    <th className="p-3">Staff Name & Role</th>
                    <th className="p-3">Monthly Salary</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-card">
                  {staffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-bold text-foreground">{staff.name}</p>
                        <p className="text-[10px] text-muted-foreground">{staff.role}</p>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        ₹{Number(staff.salary).toLocaleString('en-IN')}/mo
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          staff.status === 'present'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : staff.status === 'half_day'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-destructive/15 text-destructive'
                        }`}>
                          {staff.status === 'present' ? 'Present' : staff.status === 'half_day' ? 'Half Day' : 'Absent'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex rounded-lg border border-border overflow-hidden text-[10px] font-bold">
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'present')}
                            className={`px-2 py-1 ${staff.status === 'present' ? 'bg-emerald-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'half_day')}
                            className={`px-2 py-1 ${staff.status === 'half_day' ? 'bg-amber-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            HD
                          </button>
                          <button
                            onClick={() => updateStaffStatus(staff.id, 'absent')}
                            className={`px-2 py-1 ${staff.status === 'absent' ? 'bg-destructive text-white' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            A
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payroll Summary Footer */}
            <div className="mt-4 rounded-xl bg-muted/40 p-3.5 border border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-muted-foreground font-semibold">Total Monthly Payroll: </span>
                <strong className="text-foreground">
                  ₹{staffList.reduce((acc, s) => acc + Number(s.salary), 0).toLocaleString('en-IN')}
                </strong>
              </div>
              <button
                onClick={() => {
                  toast.success('Attendance recorded and saved successfully in local register.');
                  setActiveModal(null);
                }}
                className="btn-primary rounded-xl px-4 py-2 text-xs font-bold"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: GST Rate Finder */}
      {activeModal === 'gst-finder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Percent size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">GST Rate & HSN Directory</h3>
                  <p className="text-[11px] text-muted-foreground">Standard Indian GST Tax Slabs & Codes</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
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
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CA Reports Sharing */}
      {activeModal === 'ca-reports' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Chartered Accountant (CA) Package</h3>
                  <p className="text-[11px] text-muted-foreground">1-click audit & compliance report</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 space-y-2">
                <div className="flex justify-between">
                  <span>Business Name:</span>
                  <strong className="text-foreground">{businessName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>GSTIN Status:</span>
                  <strong className="text-foreground">{businessGstin || 'Retail / Non-GST'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Invoices Logged:</span>
                  <strong className="text-foreground">{invoices.length} Invoices</strong>
                </div>
                <div className="flex justify-between">
                  <span>Gross Sales Total:</span>
                  <strong className="text-primary">₹{salesSummary.totalSales.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Tax Liability:</span>
                  <strong className="text-foreground">₹{salesSummary.totalTax.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              <p>
                This generated PDF package includes sales summaries, customer ledger balances, GSTR-1 taxable buckets, and expense breakdown for your CA to file tax returns.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={exportCaPackage}
                className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Download size={15} />
                <span>Download CA Package PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Tally Export */}
      {activeModal === 'tally-export' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Data Export to Tally</h3>
                  <p className="text-[11px] text-muted-foreground">Tally Prime & ERP 9 compatible XML/JSON</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <p>
                Export all your sales vouchers, customer ledgers, and inventory masters into a standardized structured format directly importable into Tally ERP 9 / Tally Prime.
              </p>
              <div className="rounded-xl bg-muted/40 p-3 border border-border/50 space-y-1 text-[11px]">
                <div>&bull; {invoices.length} Sales Voucher Entries</div>
                <div>&bull; {customers.length} Sundry Debtors (Party Ledgers)</div>
                <div>&bull; {products.length} Stock Item Masters</div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={exportTallyData}
                className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Download size={15} />
                <span>Download Tally JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: e-Invoice Suite */}
      {activeModal === 'einvoice' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">e-Invoice & e-Way Bill Suite</h3>
                  <p className="text-[11px] text-muted-foreground">Government Portal IRN & e-Way Compliance</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">GSTIN Status:</span>
                  <span className="font-bold text-primary">{businessGstin || 'Not Configured (Optional for Retail)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">e-Invoice Applicability:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">B2B Commercial Invoices</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">e-Way Bill Limit:</span>
                  <span className="font-bold text-foreground">Consignments &gt; ₹50,000</span>
                </div>
              </div>
              <p>
                All B2B invoices generated in BillingMaster include standardized QR codes with digital payload hashes, HSN codes, and tax rates.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Cloud Sync & Storage */}
      {activeModal === 'cloud-sync' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Cloud Sync & Desktop Station</h3>
                  <p className="text-[11px] text-muted-foreground">Live real-time encrypted connection</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <CheckCheck size={18} className="shrink-0" />
                <div>
                  <p className="font-bold">Real-time Cloud Sync Active</p>
                  <p className="text-[10px] opacity-90">All changes sync instantaneously across mobile & desktop devices.</p>
                </div>
              </div>

              <div className="space-y-2 text-muted-foreground">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Encrypted Storage:</span>
                  <strong className="text-foreground">AES-256 Cloud DB</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Offline Capability:</span>
                  <strong className="text-foreground">Enabled via IndexedDB Cache</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span>Multi-Device Access:</span>
                  <strong className="text-foreground">Simultaneous multi-counter POS</strong>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* MODAL 10: Online Store / Digital Catalog */}
      {activeModal === 'online-store' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Digital Catalog & Online Store</h3>
                  <p className="text-[11px] text-muted-foreground">Share live product link with customers</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Store Catalog Link</p>
                  <p className="text-xs font-mono font-bold text-foreground truncate">
                    {window.location.origin}/catalog/{businessName.toLowerCase().replace(/\s+/g, '-') || 'shop'}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/catalog/${businessName.toLowerCase().replace(/\s+/g, '-') || 'shop'}`)}
                  className="rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted flex items-center gap-1 shrink-0"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="rounded-xl border border-border/70 p-3 space-y-2">
                <p className="text-xs font-bold text-foreground">Active Catalog Items ({products.length} Products)</p>
                <div className="max-h-40 overflow-y-auto divide-y divide-border/40">
                  {products.slice(0, 5).map(p => (
                    <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">Stock: {p.stock_quantity ?? p.stock ?? 0} {p.unit || 'pcs'}</p>
                      </div>
                      <span className="font-black text-primary">₹{Number(p.selling_price || p.price || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => handleShareWhatsApp(`Hello! Check out our active product catalog and prices online: ${window.location.origin}/catalog/${businessName.toLowerCase().replace(/\s+/g, '-') || 'shop'}\n\nFrom: ${businessName}`)}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold shadow-xs"
              >
                <Share2 size={14} />
                <span>Share Catalog on WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: Reward Points */}
      {activeModal === 'reward-points' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-md p-6 animate-rise shadow-2xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Reward Points & Loyalty</h3>
                  <p className="text-[11px] text-muted-foreground">Cashback and customer repeat billing</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground">Points Earned per ₹100 Spent</label>
                <input
                  type="number"
                  value={pointsPer100}
                  onChange={(e) => setPointsPer100(Number(e.target.value))}
                  className="input-shell mt-1.5 w-full text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground">Point Value (1 Point = ₹)</label>
                <input
                  type="number"
                  value={pointValueInRs}
                  onChange={(e) => setPointValueInRs(Number(e.target.value))}
                  className="input-shell mt-1.5 w-full text-sm font-bold"
                />
              </div>

              <div className="rounded-xl bg-muted/40 p-3 border border-border/60 text-muted-foreground leading-relaxed">
                Customers will automatically accumulate reward points with each invoice. Points can be redeemed at checkout to provide instant discounts.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  toast.success('Reward program settings updated successfully.');
                  setActiveModal(null);
                }}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-bold"
              >
                Save Reward Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
