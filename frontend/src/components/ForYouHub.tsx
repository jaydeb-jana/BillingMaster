import { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, FileText, Calendar, Share2, Users, BarChart3, Store,
  Send, Gift, CheckCircle2, Calculator, ArrowRight, Download,
  ExternalLink, Copy, Check, Clock, ShieldCheck, DollarSign,
  TrendingUp, RefreshCw, X, MessageSquare, Phone, Percent,
  Building2, Briefcase, Plus, FileSpreadsheet, AlertCircle,
  QrCode, Printer, Smartphone, ChevronRight, ChevronDown, CheckCheck, Mail, Search
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

  // Copied feedback & search states
  const [copied, setCopied] = useState(false);
  const [hsnSearchQuery, setHsnSearchQuery] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogStockFilter, setCatalogStockFilter] = useState<'all' | 'instock' | 'outstock' | 'lowstock'>('all');

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

  // Email Marketing State
  const [selectedEmailCampaign, setSelectedEmailCampaign] = useState<string>('offers');
  const [emailSubject, setEmailSubject] = useState<string>(`✨ Special Offer & New Arrivals from ${businessName}`);
  const [emailBody, setEmailBody] = useState<string>(
    `Dear Valued Customer,\n\nWe are delighted to share our latest product arrivals and exclusive promotions at ${businessName}.\n\nVisit our store or contact us directly to explore our curated catalog with exclusive seasonal savings!\n\nBest regards,\n${businessName}\nPhone: ${businessPhone}`
  );
  const [emailCopied, setEmailCopied] = useState<boolean>(false);

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
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-primary to-teal-800 p-6 sm:p-9 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
            <Sparkles size={14} className="text-yellow-300 animate-pulse" />
            <span>Operational & Growth Utilities Suite</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              Toolkit <span className="text-yellow-300">✨</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-white/90 font-medium leading-relaxed max-w-2xl">
              All-in-one suite of specialized commercial calculators, GST tax directories, loyalty reward engines, and CA compliance exports.
            </p>
          </div>


        </div>

        {/* Decorative ambient blur elements */}
        <div className="absolute -right-12 -bottom-12 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 h-48 w-48 rounded-full bg-yellow-400/20 blur-2xl pointer-events-none" />
      </div>

      {/* GROUP 1: Commercial & Tax Utilities */}
      <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">1</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Commercial & Tax Utilities</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Instant Real-time Engines</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Tool 1: Smart GST & Margin Calculator */}
                  <div
                    onClick={() => setActiveModal('smart-calculator')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform border border-amber-500/20 shadow-xs">
                        <Calculator size={26} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors">
                            Smart GST & Profit Margin Calculator
                          </h3>
                          <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Interactive Tool
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Calculate GST inclusive/exclusive prices, reverse tax rates from MRP, profit margin %, and retail markup in real-time.
                        </p>
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                          <span className="inline-flex items-center gap-1">
                            <span>Open Commercial Calculator</span>
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">3 Modes Included</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tool 2: HSN & GST Rate Directory */}
                  <div
                    onClick={() => setActiveModal('gst-finder')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 sm:p-6 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                        <Percent size={26} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors">
                            HSN & GST Tax Slab Directory
                          </h3>
                          <span className="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Official Directory
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Lookup official Indian GST tax slabs (0%, 5%, 12%, 18%, 28%) and HSN/SAC codes across all retail goods and services.
                        </p>
                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                          <span className="inline-flex items-center gap-1">
                            <span>Search HSN & SAC Codes</span>
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                          </span>
                          <span className="text-[10px] text-muted-foreground font-normal">Searchable Directory</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* GROUP 2: Compliance & CA Audit Suite */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold">2</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Compliance & CA Audit Suite</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">GST & Tally Integration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Tool 1: GST Filing */}
                  <div
                    onClick={() => setActiveModal('gst-filing')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                          <FileText size={24} />
                        </div>
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          GSTR-1 & 3B
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        GST Return Filing Breakdown
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Automated B2B/B2C taxable buckets, total GST collected, and monthly tax liability summaries.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Launch Tax Summary</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 2: CA Reports Sharing */}
                  <div
                    onClick={() => setActiveModal('ca-reports')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform border border-cyan-500/20 shadow-xs">
                          <ShieldCheck size={24} />
                        </div>
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          PDF Audit Pack
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        1-Click CA Audit Package
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Export formatted 5-section PDF financial statement packs for your Chartered Accountant.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Export CA Package</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 3: Tally Export */}
                  <div
                    onClick={() => setActiveModal('tally-export')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-500/20 shadow-xs">
                          <Download size={24} />
                        </div>
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          XML & JSON
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Data Export to Tally ERP
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Download company sales vouchers, party ledgers, and inventory XML for Tally sync.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Export Tally Vouchers</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>

              {/* GROUP 3: Sales & Marketing Engine */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                    <h2 className="text-base font-black text-foreground tracking-tight">Sales & Marketing Engine</h2>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">Boost Revenue & Loyalty</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Tool 1: WhatsApp Marketing */}
                  <div
                    onClick={() => toast.info('Coming Soon!', { description: 'WhatsApp Marketing will be available in an upcoming update.' })}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform border border-emerald-500/20 shadow-xs">
                          <MessageSquare size={24} />
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Coming Soon
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        WhatsApp Marketing
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Personalized WhatsApp greeting flyers, promo brochures, and digital visiting cards.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>WhatsApp Center</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 2: Email Marketing */}
                  <div
                    onClick={() => toast.info('Coming Soon!', { description: 'Email Marketing will be available in an upcoming update.' })}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-500/20 shadow-xs">
                          <Mail size={24} />
                        </div>
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          Coming Soon
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Email Marketing Studio
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Automated customer offer templates, promo codes, and seasonal email newsletters.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Email Studio</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 3: Reward Points */}
                  <div
                    onClick={() => setActiveModal('reward-points')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform border border-amber-500/20 shadow-xs">
                          <Gift size={24} />
                        </div>
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Loyalty Engine
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Reward Points & Cashback
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Configure customer purchase loyalty points, cashback rates, and auto-redemption rules.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Manage Rewards</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* Tool 4: Online Store */}
                  <div
                    onClick={() => setActiveModal('online-store')}
                    className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-500/20 shadow-xs">
                          <Store size={24} />
                        </div>
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Digital Catalog
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        Online Store Catalog
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Share your digital product catalog link with customers for instant WhatsApp ordering.
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60 text-xs font-bold text-primary">
                      <span>Share Store Link</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="card-shell w-full max-w-lg p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Calculator size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Smart Commercial Calculator</h3>
                  <p className="text-xs text-muted-foreground font-medium">GST, Margin & Markup Real-time Engine</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Calculator Mode Switcher Tabs */}
            <div className="mt-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted/70 p-1.5 text-xs font-extrabold">
              <button
                onClick={() => setCalcMode('gst')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'gst' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                GST Calculator
              </button>
              <button
                onClick={() => setCalcMode('margin')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'margin' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Profit Margin %
              </button>
              <button
                onClick={() => setCalcMode('reverse')}
                className={`py-2.5 rounded-xl transition-all ${
                  calcMode === 'reverse' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-black' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                Reverse GST (MRP)
              </button>
            </div>

            {/* Mode 1: GST Calculator */}
            {calcMode === 'gst' && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Net Base Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={calcAmount || ''}
                      onChange={(e) => setCalcAmount(Number(e.target.value))}
                      placeholder="0.00"
                      className="input-shell pl-8 w-full text-lg font-black text-foreground tracking-tight"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">Select GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2.5 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]' 
                            : 'bg-card border-border/80 hover:bg-muted text-foreground'
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
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Net Base Price:</span>
                        <span className="font-bold text-foreground">₹{calcAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">CGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">SGST ({calcGstRate / 2}%):</span>
                        <span className="font-bold text-foreground">₹{sgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">Total Tax ({calcGstRate}%):</span>
                        <span className="font-black text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-black text-foreground border-t border-border/80 pt-3">
                        <span className="text-xs uppercase tracking-wider font-extrabold text-foreground/80">Final Invoice Total</span>
                        <span className="text-lg font-black text-primary bg-primary/10 px-3 py-1 rounded-xl">₹{total.toFixed(2)}</span>
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
                    <label className="block text-xs font-bold text-foreground mb-1.5">Cost Price / Buy (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={calcCostPrice || ''}
                        onChange={(e) => setCalcCostPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className="input-shell pl-7 w-full text-sm font-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Selling Price / MRP (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">₹</span>
                      <input
                        type="number"
                        value={calcSellingPrice || ''}
                        onChange={(e) => setCalcSellingPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className="input-shell pl-7 w-full text-sm font-black"
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const profit = calcSellingPrice - calcCostPrice;
                  const marginPct = calcSellingPrice > 0 ? (profit / calcSellingPrice) * 100 : 0;
                  const markupPct = calcCostPrice > 0 ? (profit / calcCostPrice) * 100 : 0;
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Net Profit Per Unit:</span>
                        <span className={`font-black text-sm ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                          ₹{profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Gross Profit Margin:</span>
                        <span className="font-black text-foreground">{marginPct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">Cost Markup Percentage:</span>
                        <span className="font-black text-primary">{markupPct.toFixed(2)}%</span>
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
                  <label className="block text-xs font-bold text-foreground mb-1.5">MRP / Gross Amount with GST (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={calcAmount || ''}
                      onChange={(e) => setCalcAmount(Number(e.target.value))}
                      placeholder="0.00"
                      className="input-shell pl-8 w-full text-lg font-black text-foreground tracking-tight"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-2">Included GST Slab Rate</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 5, 12, 18, 28].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setCalcGstRate(rate)}
                        className={`rounded-xl py-2.5 text-xs font-black border transition-all ${
                          calcGstRate === rate 
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]' 
                            : 'bg-card border-border/80 hover:bg-muted text-foreground'
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
                    <div className="rounded-2xl bg-gradient-to-br from-card via-muted/30 to-primary/5 p-4 sm:p-5 border border-border/80 shadow-xs space-y-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Actual Base Price (Pre-Tax):</span>
                        <span className="font-black text-foreground">₹{basePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium">Extracted GST ({calcGstRate}%):</span>
                        <span className="font-black text-primary">₹{taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-border/60 pt-2.5">
                        <span className="font-bold text-muted-foreground">CGST + SGST Split:</span>
                        <span className="font-black text-foreground bg-muted px-2.5 py-1 rounded-lg">₹{(taxAmount / 2).toFixed(2)} + ₹{(taxAmount / 2).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm"
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

      {/* MODAL 2.5: Email Marketing Studio */}
      {activeModal === 'email-marketing' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 animate-rise shadow-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Email Marketing Studio</h3>
                  <p className="text-[11px] text-muted-foreground">Reach clients with newsletters, promotions & announcements</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Campaign Preset Tabs */}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-foreground">Select Campaign Template</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'offers',
                    label: 'Special Offer',
                    desc: 'Exclusive discount code',
                    subject: `🔥 Special Customer Discount: Up to 20% OFF at ${businessName}`,
                    body: `Dear Valued Customer,\n\nAs a token of our appreciation for your continued trust in ${businessName}, we are excited to offer you an exclusive discount on your next purchase.\n\nUse offer code "EXCLUSIVE20" or show this email during checkout to receive your discount!\n\n📍 Visit us or reply to this email for instant inquiries.\n\nBest regards,\n${businessName}\nPhone: ${businessPhone}`
                  },
                  {
                    id: 'new_arrivals',
                    label: 'New Collection',
                    desc: 'Fresh catalog & stock',
                    subject: `✨ Fresh Stock & New Arrivals Now in Store — ${businessName}`,
                    body: `Dear Customer,\n\nWe are excited to inform you that new arrivals have just landed at ${businessName}! Explore our latest collection designed to provide top quality and unbeatable value.\n\nCheck out the fresh products today before stocks run out.\n\nContact us directly for bookings or questions.\n\nWarm regards,\n${businessName}\nPhone: ${businessPhone}`
                  },
                  {
                    id: 'announcement',
                    label: 'Announcement',
                    desc: 'Store updates & news',
                    subject: `📢 Important Business Update from ${businessName}`,
                    body: `Dear Customer,\n\nWe have exciting updates to share with you from ${businessName}! We have expanded our product inventory and enhanced our customer service to serve you even better.\n\nThank you for being a valued part of our journey.\n\nSincerely,\n${businessName}\nPhone: ${businessPhone}`
                  },
                ].map((camp) => (
                  <button
                    key={camp.id}
                    onClick={() => {
                      setSelectedEmailCampaign(camp.id);
                      setEmailSubject(camp.subject);
                      setEmailBody(camp.body);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedEmailCampaign === camp.id
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

            {/* Subject line */}
            <div className="mt-4 space-y-1.5">
              <label className="block text-xs font-bold text-foreground">Email Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject line..."
                className="input-shell w-full text-xs font-bold p-3"
              />
            </div>

            {/* Email Body Editor */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground">Email Body</label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
                    setEmailCopied(true);
                    toast.success('Email subject and body copied to clipboard!');
                    setTimeout(() => setEmailCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {emailCopied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{emailCopied ? 'Copied' : 'Copy Full Email'}</span>
                </button>
              </div>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="input-shell w-full text-xs font-medium leading-relaxed p-3"
              />
            </div>

            {/* Send to Customer with Email */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-bold text-foreground">
                Customer Email Recipients ({customers.filter((c) => c.email).length} of {customers.length} Contacts Have Email)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
                {customers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No customer contacts found. Add customers in the Customers tab.
                  </div>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors">
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="text-xs font-bold text-foreground truncate">{c.name || c.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.email || 'No email registered'}</p>
                      </div>
                      {c.email ? (
                        <a
                          href={`mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-[10px] font-bold shadow-2xs cursor-pointer shrink-0"
                        >
                          <Send size={11} />
                          <span>Send Email</span>
                        </a>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground/60 shrink-0">
                          Email missing
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* General Actions */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Close
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="btn-primary flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
              >
                <Mail size={14} />
                <span>Open in Email App</span>
              </a>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="card-shell w-full max-w-xl p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Percent size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">GST Rate & HSN Directory</h3>
                  <p className="text-xs text-muted-foreground font-medium">Standard Indian GST Tax Slabs & Official Codes</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Directory Search & Filter */}
            <div className="mt-4 shrink-0 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={hsnSearchQuery}
                onChange={(e) => setHsnSearchQuery(e.target.value)}
                placeholder="Search HSN code (e.g. 8517), product name, or slab rate..."
                className="input-shell pl-9 pr-8 w-full text-xs font-bold"
              />
              {hsnSearchQuery && (
                <button
                  onClick={() => setHsnSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* HSN & Slab Rate Items List */}
            <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1">
              {[
                { hsn: '0000', item: 'Fresh Fruits, Vegetables, Milk, Salt, Curd & Grain', rate: '0%', taxDetails: 'Nil Rated (Exempted)', type: 'Exempt Goods' },
                { hsn: '1006', item: 'Packaged Food Items, Edible Oil, Tea, Coffee, Sugar', rate: '5%', taxDetails: '2.5% CGST + 2.5% SGST', type: 'Essential Goods' },
                { hsn: '6101', item: 'Apparel & Readymade Clothing (> ₹1,000 value)', rate: '12%', taxDetails: '6.0% CGST + 6.0% SGST', type: 'Standard Rate 1' },
                { hsn: '8517', item: 'Smartphones, Electronic Hardware, IT Services, Telecom', rate: '18%', taxDetails: '9.0% CGST + 9.0% SGST', type: 'Standard Rate 2' },
                { hsn: '8703', item: 'Automobiles, Air Conditioners, Luxury Goods, Cigarettes', rate: '28%', taxDetails: '14.0% CGST + 14.0% SGST', type: 'Luxury Rate' },
              ]
                .filter((item) => {
                  const q = hsnSearchQuery.toLowerCase();
                  return item.hsn.includes(q) || item.item.toLowerCase().includes(q) || item.rate.includes(q) || item.type.toLowerCase().includes(q);
                })
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="shrink-0 rounded-xl bg-muted px-2.5 py-1.5 text-xs font-black font-mono text-foreground border border-border/60">
                        HSN {item.hsn}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-extrabold text-foreground leading-snug">
                          {item.item}
                        </h4>
                        <span className="inline-block text-[10px] font-bold text-muted-foreground mt-0.5">
                          {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                      <div className="text-left sm:text-right">
                        <span className="inline-block text-xs sm:text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-xl">
                          {item.rate}
                        </span>
                        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                          {item.taxDetails}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-5 shrink-0 flex justify-end pt-3 border-t border-border/60">
              <button
                onClick={() => setActiveModal(null)}
                className="btn-primary rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-sm"
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



      {/* MODAL 10: Online Store / Digital Catalog (Read-Only Stock Inspector) */}
      {activeModal === 'online-store' && (() => {
        const inStockCount = products.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) > 4).length;
        const lowStockCount = products.filter(p => {
          const qty = Number(p.stock_quantity ?? p.stock ?? 0);
          return qty > 0 && qty <= 4;
        }).length;
        const outOfStockCount = products.filter(p => (Number(p.stock_quantity ?? p.stock ?? 0)) <= 0).length;

        const filteredCatalog = products.filter(p => {
          const qty = Number(p.stock_quantity ?? p.stock ?? 0);
          const matchesSearch = !catalogSearch || 
            (p.name && p.name.toLowerCase().includes(catalogSearch.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(catalogSearch.toLowerCase())) ||
            (p.hsn_code && String(p.hsn_code).includes(catalogSearch));

          if (!matchesSearch) return false;
          if (catalogStockFilter === 'instock') return qty > 4;
          if (catalogStockFilter === 'lowstock') return qty > 0 && qty <= 4;
          if (catalogStockFilter === 'outstock') return qty <= 0;
          return true;
        });

        const storeUrl = `${window.location.origin}/catalog/${businessName.toLowerCase().replace(/\s+/g, '-') || 'shop'}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
            <div className="card-shell w-full max-w-2xl p-6 sm:p-7 animate-rise shadow-2xl border border-border max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs">
                    <Store size={22} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Digital Store Catalog & Stock Inspector</h3>
                    <p className="text-xs text-muted-foreground font-medium">Read-Only Stock Availability & Price Directory</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">


                {/* Live Store Link Bar */}
                <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Shareable Read-Only Catalog Link</p>
                    <p className="text-xs font-mono font-bold text-foreground truncate mt-0.5">
                      {storeUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(storeUrl)}
                    className="rounded-xl bg-card border border-border/80 px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copied ? 'Link Copied!' : 'Copy Catalog Link'}</span>
                  </button>
                </div>

                {/* Stock Overview Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl border border-border/70 bg-card p-3 text-center">
                    <p className="text-[10px] font-extrabold text-muted-foreground uppercase">Total Products</p>
                    <p className="text-base font-black text-foreground mt-0.5">{products.length}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">In Stock</p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{inStockCount}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase">Low Stock</p>
                    <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">{lowStockCount}</p>
                  </div>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                    <p className="text-[10px] font-extrabold text-red-600 dark:text-red-400 uppercase">Out of Stock</p>
                    <p className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">{outOfStockCount}</p>
                  </div>
                </div>

                {/* Search & Stock Filter Bar */}
                <div className="space-y-2.5 pt-1">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Filter catalog by product name, category, or HSN..."
                      className="w-full rounded-xl bg-background border border-border/80 pl-9 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {catalogSearch && (
                      <button
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Stock Availability Filter Buttons */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setCatalogStockFilter('all')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      All Items ({products.length})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('instock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'instock'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      In Stock ({inStockCount})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('lowstock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'lowstock'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                      }`}
                    >
                      Low Stock ({lowStockCount})
                    </button>
                    <button
                      onClick={() => setCatalogStockFilter('outstock')}
                      className={`rounded-xl px-3 py-1.5 font-bold transition-colors whitespace-nowrap ${
                        catalogStockFilter === 'outstock'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      Out of Stock ({outOfStockCount})
                    </button>
                  </div>
                </div>

                {/* Filtered Product Items Inventory Table/List */}
                <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                  {filteredCatalog.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Store size={32} className="mx-auto text-muted-foreground/50" />
                      <p className="text-xs font-bold text-muted-foreground">No matching products found in catalog.</p>
                      <button
                        onClick={() => { setCatalogSearch(''); setCatalogStockFilter('all'); }}
                        className="text-xs font-extrabold text-primary hover:underline"
                      >
                        Reset Search Filters
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                      {filteredCatalog.map((p) => {
                        const qty = Number(p.stock_quantity ?? p.stock ?? 0);
                        const unit = p.unit || 'pcs';
                        const price = Number(p.selling_price || p.price || 0);

                        let badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                        let statusText = `In Stock (${qty} ${unit})`;
                        if (qty <= 0) {
                          badgeColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
                          statusText = `Out of Stock (0 ${unit})`;
                        } else if (qty <= 4) {
                          badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
                          statusText = `Low Stock (${qty} ${unit})`;
                        }

                        const imgUrl = p.image_url || p.image || p.photo_url || (p.notes && typeof p.notes === 'string' && (p.notes.startsWith('{') || p.notes.startsWith('[')) ? (() => { try { const parsed = JSON.parse(p.notes); return parsed.image_url || parsed.image || ''; } catch (e) { return ''; } })() : '');

                        return (
                          <div key={p.id} className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                            {imgUrl && (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="h-11 w-11 shrink-0 rounded-xl object-contain p-0.5 border border-border/80 bg-muted/30"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs sm:text-sm font-extrabold text-foreground truncate">{p.name}</p>
                                {p.hsn_code && (
                                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-mono font-bold text-muted-foreground">
                                    HSN {p.hsn_code}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Category: {p.category || p.category_name || 'General'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black border ${badgeColor}`}>
                                  {statusText}
                                </span>
                                <p className="text-xs font-black text-foreground mt-1">
                                  ₹{price.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Close Inspector
                </button>
                <button
                  onClick={() => handleShareWhatsApp(`Hello! Check our live product availability and stock inventory online:\n${storeUrl}\n\nFrom: ${businessName}`)}
                  className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold shadow-xs"
                >
                  <Share2 size={14} />
                  <span>Share Catalog Link on WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
