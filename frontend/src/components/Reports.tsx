import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, Download,
  Printer, FileText, Package, Users, Wallet, Receipt, ArrowUpRight,
  ArrowDownRight, Filter, Search, CheckCircle2, Clock, AlertTriangle,
  Percent, Building2, RefreshCw, FileSpreadsheet, Layers, PieChart as PieChartIcon
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';
import jsPDF from 'jspdf';
import { db, auth, getBusinessId } from '@/lib/api';
import { Link } from 'wouter';
import { AnimatedValue } from './AnimatedValue';

type DatePreset = 'all' | 'today' | 'yesterday' | '7days' | 'this_month' | 'last_month' | 'this_year' | 'custom';
type ReportTab = 'sales' | 'products' | 'customers' | 'tax' | 'pnl';

interface InvoiceRecord {
  id: string;
  invoice_number?: string;
  customer_id?: string;
  issue_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  total?: number;
  status?: string;
  notes?: string;
  items?: Array<{ product_id?: string; name?: string; quantity?: number; unit_price?: number; total?: number }>;
  currency?: string;
  created_at?: string;
}

interface ProductRecord {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  selling_price?: number;
  purchase_price?: number;
  stock_quantity?: number;
  min_stock_level?: number;
  unit?: string;
  category?: string;
}

interface CustomerRecord {
  id: string;
  name?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface ExpenseRecord {
  id: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  payment_method?: string;
}

const COLORS = ['#1a7f8e', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];

export function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [taxSettings, setTaxSettings] = useState<any>({ enable_tax: false, tax_name: 'Tax', tax_rate: 18 });
  const [loading, setLoading] = useState(true);

  // Load all necessary dataset
  const loadData = async () => {
    setLoading(true);
    try {
      const [invList, prodList, custList] = await Promise.all([
        db.list<InvoiceRecord>('invoices', { order: 'issue_date.desc' }),
        db.list<ProductRecord>('products'),
        db.list<CustomerRecord>('customers'),
      ]);

      setInvoices(invList || []);
      setProducts(prodList || []);
      setCustomers(custList || []);

      // Load expenses from local/db
      const localExp = localStorage.getItem('billing_expenses_list');
      if (localExp) {
        try {
          setExpenses(JSON.parse(localExp));
        } catch {
          setExpenses([]);
        }
      }

      // Load business & tax profile
      const session = auth.session();
      if (session?.user) {
        const rawBiz = localStorage.getItem(`arventa_biz_${session.user.id}`);
        if (rawBiz) {
          try { setBusiness(JSON.parse(rawBiz)); } catch { /* ignore */ }
        } else {
          const bId = await getBusinessId();
          if (bId) {
            const bList = await db.list<any>('businesses', { id: bId });
            if (bList.length) setBusiness(bList[0]);
          }
        }

        const rawTax = localStorage.getItem('arventa_tax_settings');
        if (rawTax) {
          try { setTaxSettings(JSON.parse(rawTax)); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute date range
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { start: yStr, end: yStr };
    }
    if (datePreset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      return { start: past.toISOString().split('T')[0], end: todayStr };
    }
    if (datePreset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr };
    }
    if (datePreset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start: firstDay, end: lastDay };
    }
    if (datePreset === 'this_year') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      return { start: firstDay, end: todayStr };
    }
    if (datePreset === 'custom' && customStartDate) {
      return { start: customStartDate, end: customEndDate || todayStr };
    }
    return { start: '2000-01-01', end: '2099-12-31' };
  }, [datePreset, customStartDate, customEndDate]);

  // Customer Map
  const customerMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      map.set(c.id, c.name || c.full_name || 'Customer');
    });
    return map;
  }, [customers]);

  // Filtered Invoices based on Date & Search
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invDate = inv.issue_date || (inv.created_at ? inv.created_at.split('T')[0] : '');
      if (invDate) {
        if (invDate < dateRange.start || invDate > dateRange.end) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cName = (inv.customer_id ? customerMap.get(inv.customer_id) : 'Walk-in') || '';
        const num = inv.invoice_number || '';
        const st = inv.status || '';
        return num.toLowerCase().includes(q) || cName.toLowerCase().includes(q) || st.toLowerCase().includes(q);
      }
      return true;
    });
  }, [invoices, dateRange, searchQuery, customerMap]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const eDate = e.date;
      if (eDate) {
        if (eDate < dateRange.start || eDate > dateRange.end) return false;
      }
      return true;
    });
  }, [expenses, dateRange]);

  // Key Sales & Revenue Calculations
  const salesMetrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalInvoicesCount = filteredInvoices.length;

    filteredInvoices.forEach((inv) => {
      const tot = Number(inv.total || 0);
      const tax = Number(inv.tax_amount || 0);
      const disc = Number(inv.discount_amount || 0);
      const isPaid = inv.status === 'paid' || inv.status === 'complete';

      totalSales += tot;
      totalTax += tax;
      totalDiscount += disc;

      if (isPaid) {
        totalPaid += tot;
      } else {
        totalDue += tot;
      }
    });

    const avgInvoice = totalInvoicesCount > 0 ? totalSales / totalInvoicesCount : 0;
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 100;

    return {
      totalSales,
      totalPaid,
      totalDue,
      totalTax,
      totalDiscount,
      totalInvoicesCount,
      avgInvoice,
      collectionRate,
    };
  }, [filteredInvoices]);

  // Daily Sales Trend Chart Data
  const trendChartData = useMemo(() => {
    const map = new Map<string, { date: string; sales: number; paid: number; due: number; count: number }>();

    filteredInvoices.forEach((inv) => {
      const d = inv.issue_date || (inv.created_at ? inv.created_at.split('T')[0] : 'Unknown');
      const tot = Number(inv.total || 0);
      const isPaid = inv.status === 'paid' || inv.status === 'complete';

      if (!map.has(d)) {
        map.set(d, { date: d, sales: 0, paid: 0, due: 0, count: 0 });
      }
      const item = map.get(d)!;
      item.sales += tot;
      if (isPaid) item.paid += tot;
      else item.due += tot;
      item.count += 1;
    });

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        formattedDate: item.date.length >= 10 ? item.date.slice(5) : item.date,
      }));
  }, [filteredInvoices]);

  // Payment Status Distribution Pie
  const paymentStatusPieData = useMemo(() => {
    return [
      { name: 'Paid Collections', value: salesMetrics.totalPaid, color: '#10b981' },
      { name: 'Due / Outstanding', value: salesMetrics.totalDue, color: '#f59e0b' },
    ].filter((i) => i.value > 0);
  }, [salesMetrics]);

  // Top Products Analytics
  const productAnalytics = useMemo(() => {
    const map = new Map<string, { id: string; name: string; qty: number; revenue: number }>();

    filteredInvoices.forEach((inv) => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach((it) => {
          const name = it.name || 'Unnamed Product';
          const qty = Number(it.quantity || 1);
          const rev = Number(it.total || (qty * Number(it.unit_price || 0)));

          if (!map.has(name)) {
            map.set(name, { id: it.product_id || name, name, qty: 0, revenue: 0 });
          }
          const curr = map.get(name)!;
          curr.qty += qty;
          curr.revenue += rev;
        });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);

    // Stock metrics
    let totalStockUnits = 0;
    let totalAssetValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const stock = Number(p.stock_quantity || 0);
      const minStock = Number(p.min_stock_level || 5);
      const price = Number(p.selling_price || p.purchase_price || 0);

      totalStockUnits += stock;
      totalAssetValue += stock * price;

      if (stock <= 0) outOfStockCount++;
      else if (stock <= minStock) lowStockCount++;
    });

    return {
      topSold: list,
      totalStockUnits,
      totalAssetValue,
      lowStockCount,
      outOfStockCount,
      totalProductsCount: products.length,
    };
  }, [filteredInvoices, products]);

  // Customer Analytics & Receivables
  const customerAnalytics = useMemo(() => {
    const map = new Map<string, { id: string; name: string; invoicesCount: number; totalSpent: number; totalDue: number; lastDate: string }>();

    filteredInvoices.forEach((inv) => {
      const cId = inv.customer_id || 'walk_in';
      const cName = inv.customer_id ? customerMap.get(inv.customer_id) || 'Customer' : 'Walk-in Customer';
      const tot = Number(inv.total || 0);
      const isPaid = inv.status === 'paid' || inv.status === 'complete';
      const d = inv.issue_date || '';

      if (!map.has(cId)) {
        map.set(cId, { id: cId, name: cName, invoicesCount: 0, totalSpent: 0, totalDue: 0, lastDate: d });
      }
      const item = map.get(cId)!;
      item.invoicesCount += 1;
      item.totalSpent += tot;
      if (!isPaid) item.totalDue += tot;
      if (d > item.lastDate) item.lastDate = d;
    });

    const list = Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    return list;
  }, [filteredInvoices, customerMap]);

  // Profit & Loss Summary
  const pnlMetrics = useMemo(() => {
    const totalRevenue = salesMetrics.totalSales;
    const totalCollected = salesMetrics.totalPaid;
    const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const estimatedCOGS = filteredInvoices.reduce((sum, inv) => {
      let cost = 0;
      if (Array.isArray(inv.items)) {
        inv.items.forEach((it) => {
          const qty = Number(it.quantity || 1);
          // find matching product for purchase_price
          const prod = products.find((p) => p.id === it.product_id || p.name.toLowerCase() === (it.name || '').toLowerCase());
          const unitCost = Number(prod?.purchase_price || (Number(it.unit_price || 0) * 0.7));
          cost += unitCost * qty;
        });
      } else {
        cost = Number(inv.total || 0) * 0.7; // default 30% margin estimate if no itemized cost
      }
      return sum + cost;
    }, 0);

    const grossProfit = totalRevenue - estimatedCOGS;
    const netOperatingProfit = grossProfit - totalExpensesAmount;
    const netProfitMargin = totalRevenue > 0 ? (netOperatingProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCollected,
      totalExpensesAmount,
      estimatedCOGS,
      grossProfit,
      netOperatingProfit,
      netProfitMargin,
    };
  }, [salesMetrics, filteredExpenses, filteredInvoices, products]);

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (activeTab === 'sales') {
      csvContent += 'Invoice Number,Date,Customer,Status,Tax Amount,Discount,Total Amount\n';
      filteredInvoices.forEach((inv) => {
        const cName = (inv.customer_id ? customerMap.get(inv.customer_id) : 'Walk-in') || 'Walk-in';
        csvContent += `"${inv.invoice_number || ''}","${inv.issue_date || ''}","${cName}","${inv.status || 'due'}","${inv.tax_amount || 0}","${inv.discount_amount || 0}","${inv.total || 0}"\n`;
      });
    } else if (activeTab === 'products') {
      csvContent += 'Product Name,SKU,Category,Selling Price,Stock Quantity,Inventory Valuation\n';
      products.forEach((p) => {
        const val = Number(p.stock_quantity || 0) * Number(p.selling_price || 0);
        csvContent += `"${p.name}","${p.sku || ''}","${p.category || 'General'}","${p.selling_price || 0}","${p.stock_quantity || 0}","${val}"\n`;
      });
    } else if (activeTab === 'customers') {
      csvContent += 'Customer Name,Total Invoices,Total Spent,Total Due,Last Purchase Date\n';
      customerAnalytics.forEach((c) => {
        csvContent += `"${c.name}","${c.invoicesCount}","${c.totalSpent}","${c.totalDue}","${c.lastDate}"\n`;
      });
    } else if (activeTab === 'pnl' || activeTab === 'tax') {
      csvContent += 'Metric,Amount\n';
      csvContent += `"Total Gross Sales","${salesMetrics.totalSales}"\n`;
      csvContent += `"Total Tax Collected","${salesMetrics.totalTax}"\n`;
      csvContent += `"Total Collected Cash","${salesMetrics.totalPaid}"\n`;
      csvContent += `"Total Outstanding Due","${salesMetrics.totalDue}"\n`;
      csvContent += `"Operating Expenses","${pnlMetrics.totalExpensesAmount}"\n`;
      csvContent += `"Net Operating Profit","${pnlMetrics.netOperatingProfit}"\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reports_${activeTab}_${datePreset}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF Report Statement
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const bizName = business?.name || 'BillingMaster Store';
    const bizPhone = business?.phone || '';
    const bizEmail = business?.email || '';

    // Header styling
    doc.setFillColor(26, 127, 142);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(bizName.toUpperCase(), 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Official Business Analytics & Statement Report`, 14, 24);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 140, 24);

    // Business info & Metadata
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    let yPos = 40;
    doc.text(`Generated on: ${new Date().toLocaleString('en-US')}`, 14, yPos);
    if (bizPhone || bizEmail) {
      doc.text(`Contact: ${[bizPhone, bizEmail].filter(Boolean).join(' | ')}`, 14, yPos + 6);
      yPos += 6;
    }

    // Summary Box
    yPos += 8;
    doc.setFillColor(245, 247, 248);
    doc.roundedRect(14, yPos, 182, 34, 3, 3, 'F');
    doc.setDrawColor(220, 225, 230);
    doc.roundedRect(14, yPos, 182, 34, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 127, 142);
    doc.text('EXECUTIVE EXECUTIVE SUMMARY', 20, yPos + 8);

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Gross Sales: INR ${salesMetrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 20, yPos + 16);
    doc.text(`Collected Paid: INR ${salesMetrics.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 20, yPos + 24);
    doc.text(`Tax Collected: INR ${salesMetrics.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 105, yPos + 16);
    doc.text(`Outstanding Due: INR ${salesMetrics.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 105, yPos + 24);

    // Table Header
    yPos += 44;
    doc.setFillColor(235, 240, 242);
    doc.rect(14, yPos, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    doc.text('Invoice #', 16, yPos + 5.5);
    doc.text('Date', 50, yPos + 5.5);
    doc.text('Customer', 85, yPos + 5.5);
    doc.text('Status', 135, yPos + 5.5);
    doc.text('Amount (INR)', 165, yPos + 5.5);

    yPos += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    const rowsToPrint = filteredInvoices.slice(0, 30);
    rowsToPrint.forEach((inv) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const cName = (inv.customer_id ? customerMap.get(inv.customer_id) : 'Walk-in') || 'Walk-in';
      const isPaid = inv.status === 'paid' || inv.status === 'complete';
      
      doc.text(String(inv.invoice_number || '—').substring(0, 16), 16, yPos);
      doc.text(String(inv.issue_date || '—'), 50, yPos);
      doc.text(String(cName).substring(0, 24), 85, yPos);
      doc.text(isPaid ? 'PAID' : 'DUE', 135, yPos);
      doc.text(Number(inv.total || 0).toFixed(2), 165, yPos);
      
      doc.setDrawColor(240, 240, 240);
      doc.line(14, yPos + 2, 196, yPos + 2);
      yPos += 7;
    });

    if (filteredInvoices.length > 30) {
      doc.setFont('helvetica', 'italic');
      doc.text(`... and ${filteredInvoices.length - 30} more records (download CSV for full ledger).`, 14, yPos + 4);
    }

    doc.save(`Financial_Report_${datePreset}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header bar with Filters & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[.18em] text-primary flex items-center gap-1.5">
            <BarChart3 size={14} /> Analytics & Intelligence
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Business Reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Comprehensive audit, cash flow, stock turnover, and financial ledgers.</p>
        </div>

        {/* Global Export & Print Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            className="input-shell inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground shadow-sm"
            title="Refresh dataset"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="input-shell inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/60 shadow-sm"
            title="Download CSV spreadsheet"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm"
            title="Download official PDF report"
          >
            <Download size={14} />
            <span>PDF Statement</span>
          </button>

          <button
            onClick={() => window.print()}
            className="input-shell inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground print:hidden shadow-sm"
            title="Print view"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Pill Bar */}
      <div className="card-shell p-3.5 sm:p-4 bg-card/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground">Timeline Range:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id as DatePreset)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  datePreset === preset.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range inputs */}
        {datePreset === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input-shell px-2 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input-shell px-2 py-1 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="card-shell p-4.5 animate-rise">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gross Sales</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mono mt-2 text-xl sm:text-2xl font-bold text-foreground">
            <AnimatedValue value={`INR ${salesMetrics.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="font-semibold text-foreground"><AnimatedValue value={salesMetrics.totalInvoicesCount} /></span> invoices issued
          </div>
        </div>

        <div className="card-shell p-4.5 animate-rise delay-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cash Collected</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mono mt-2 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            <AnimatedValue value={`INR ${salesMetrics.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            <AnimatedValue value={`${salesMetrics.collectionRate.toFixed(1)}%`} /> collection rate
          </div>
        </div>

        <div className="card-shell p-4.5 animate-rise delay-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding Due</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
              <Clock size={16} />
            </div>
          </div>
          <div className="mono mt-2 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            <AnimatedValue value={`INR ${salesMetrics.totalDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
          </div>
          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Awaiting customer payment
          </div>
        </div>

        <div className="card-shell p-4.5 animate-rise delay-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Profit (P&L)</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/10 text-purple-600">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mono mt-2 text-xl sm:text-2xl font-bold text-foreground">
            <AnimatedValue value={`INR ${pnlMetrics.netOperatingProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Margin: <span className="font-semibold text-foreground">{pnlMetrics.netProfitMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Report Module Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-2">
        {[
          { id: 'sales', label: 'Sales & Revenue', icon: DollarSign },
          { id: 'products', label: 'Product & Stock', icon: Package },
          { id: 'customers', label: 'Customer Ledgers', icon: Users },
          { id: 'tax', label: 'Tax / GST Summary', icon: Percent },
          { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60'
              }`}
            >
              <TabIcon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================== TAB 1: SALES & REVENUE ===================== */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Sales Trend Bar / Area Chart */}
            <div className="card-shell p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-foreground">Sales & Collections Velocity</h3>
                  <p className="text-xs text-muted-foreground">Billed invoices vs received cash over time</p>
                </div>
              </div>

              {trendChartData.length > 0 ? (
                <div className="h-[280px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100,100,100,0.15)" />
                      <XAxis dataKey="formattedDate" stroke="#888" fontSize={11} tickLine={false} />
                      <YAxis stroke="#888" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="sales" name="Billed Sales" fill="#1a7f8e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paid" name="Collected Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="due" name="Outstanding Due" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
                  No invoice activity recorded in this date range.
                </div>
              )}
            </div>

            {/* Payment Distribution Donut Chart */}
            <div className="card-shell p-5">
              <div className="mb-4">
                <h3 className="text-sm font-extrabold text-foreground">Collection Distribution</h3>
                <p className="text-xs text-muted-foreground">Settled revenue vs pending payments</p>
              </div>

              {paymentStatusPieData.length > 0 ? (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentStatusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentStatusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry?.color || '#10b981'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-muted-foreground">Paid (₹{salesMetrics.totalPaid.toLocaleString('en-IN')})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-amber-500" />
                      <span className="font-semibold text-muted-foreground">Due (₹{salesMetrics.totalDue.toLocaleString('en-IN')})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                  No payment data in this period.
                </div>
              )}
            </div>
          </div>

          {/* Detailed Invoice Ledger Table */}
          <div className="card-shell overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-foreground">Sales Ledger & Invoices</h3>
                <p className="text-xs text-muted-foreground">Itemized records for the selected timeline.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter invoice or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-shell w-full pl-9 pr-3 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((inv) => {
                      const cName = (inv.customer_id ? customerMap.get(inv.customer_id) : 'Walk-in') || 'Walk-in Customer';
                      const isPaid = inv.status === 'paid' || inv.status === 'complete';
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="mono px-4 py-3.5 font-bold text-foreground">
                            <Link href={`/invoices/${inv.id}`} className="hover:text-primary transition-colors">
                              {inv.invoice_number || 'Draft'}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">{inv.issue_date || '—'}</td>
                          <td className="px-4 py-3.5 font-medium text-foreground">{cName}</td>
                          <td className="mono px-4 py-3.5 text-right text-muted-foreground">
                            {inv.tax_amount ? `₹${Number(inv.tax_amount).toFixed(2)}` : '—'}
                          </td>
                          <td className="mono px-4 py-3.5 text-right text-muted-foreground">
                            {inv.discount_amount ? `₹${Number(inv.discount_amount).toFixed(2)}` : '—'}
                          </td>
                          <td className="mono px-4 py-3.5 text-right font-bold text-foreground">
                            ₹{Number(inv.total || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                              }`}
                            >
                              {isPaid ? 'PAID' : 'DUE'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="text-xs font-bold text-primary hover:underline"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        No invoice records found matching the current criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: PRODUCT & STOCK ANALYTICS ===================== */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Stock Metrics summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="card-shell p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Catalog</span>
              <div className="mono mt-1 text-2xl font-bold">{productAnalytics.totalProductsCount} items</div>
              <span className="text-[11px] text-muted-foreground">Active inventory items</span>
            </div>
            <div className="card-shell p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Stock Units</span>
              <div className="mono mt-1 text-2xl font-bold">{productAnalytics.totalStockUnits} units</div>
              <span className="text-[11px] text-muted-foreground">Physical items in storage</span>
            </div>
            <div className="card-shell p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asset Valuation</span>
              <div className="mono mt-1 text-2xl font-bold text-primary">
                ₹{productAnalytics.totalAssetValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[11px] text-muted-foreground">Total inventory worth</span>
            </div>
            <div className="card-shell p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Low Stock Alert</span>
              <div className="mono mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {productAnalytics.lowStockCount + productAnalytics.outOfStockCount}
              </div>
              <span className="text-[11px] text-muted-foreground">Needs replenishment</span>
            </div>
          </div>

          {/* Top Selling Products Chart */}
          <div className="card-shell p-5">
            <div className="mb-4">
              <h3 className="text-sm font-extrabold text-foreground">Top Performing Products by Revenue</h3>
              <p className="text-xs text-muted-foreground">Sales volume and gross revenue generated in this date range</p>
            </div>

            {productAnalytics.topSold.length > 0 ? (
              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productAnalytics.topSold.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(100,100,100,0.15)" />
                    <XAxis type="number" stroke="#888" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                    <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} width={120} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#1a7f8e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
                No product sales recorded in the selected period.
              </div>
            )}
          </div>

          {/* Inventory Valuation & Replenishment Table */}
          <div className="card-shell overflow-hidden">
            <div className="border-b border-border/70 p-4">
              <h3 className="text-sm font-extrabold text-foreground">Complete Stock Audit & Health</h3>
              <p className="text-xs text-muted-foreground">Current inventory levels, unit prices, and status alerts.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU / Barcode</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-right">Stock Level</th>
                    <th className="px-4 py-3 text-right">Inventory Value</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.length > 0 ? (
                    products.map((p) => {
                      const stock = Number(p.stock_quantity || 0);
                      const minStock = Number(p.min_stock_level || 5);
                      const price = Number(p.selling_price || 0);
                      const val = stock * price;
                      const isLow = stock <= minStock && stock > 0;
                      const isOut = stock <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-foreground">{p.name}</td>
                          <td className="mono px-4 py-3.5 text-muted-foreground">{p.sku || p.barcode || '—'}</td>
                          <td className="mono px-4 py-3.5 text-right">₹{price.toFixed(2)}</td>
                          <td className="mono px-4 py-3.5 text-right font-bold text-foreground">
                            {stock} {p.unit || 'units'}
                          </td>
                          <td className="mono px-4 py-3.5 text-right font-bold text-primary">
                            ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {isOut ? (
                              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-extrabold text-destructive border border-destructive/25">
                                OUT OF STOCK
                              </span>
                            ) : isLow ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                LOW STOCK
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                IN STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        No inventory items found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: CUSTOMER LEDGERS ===================== */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="card-shell overflow-hidden">
            <div className="border-b border-border/70 p-4">
              <h3 className="text-sm font-extrabold text-foreground">Customer Purchasing & Credit Ledger</h3>
              <p className="text-xs text-muted-foreground">Highest-value buyers and outstanding credit balances.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/70 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3 text-center">Invoices</th>
                    <th className="px-4 py-3 text-right">Total Purchased</th>
                    <th className="px-4 py-3 text-right">Current Outstanding</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {customerAnalytics.length > 0 ? (
                    customerAnalytics.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-foreground">{c.name}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-muted-foreground">{c.invoicesCount}</td>
                        <td className="mono px-4 py-3.5 text-right font-bold text-foreground">
                          ₹{c.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="mono px-4 py-3.5 text-right font-bold">
                          {c.totalDue > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              ₹{c.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Settled (₹0.00)</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">{c.lastDate || '—'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={c.id !== 'walk_in' ? `/khatabook/${c.id}` : '/khatabook'}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Khata Passbook
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        No customer purchase records in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: TAX / GST SUMMARY ===================== */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-shell p-4.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxable Turnover</span>
              <div className="mono mt-1 text-2xl font-bold">
                ₹{(salesMetrics.totalSales - salesMetrics.totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-muted-foreground">Net sales before taxes</span>
            </div>
            <div className="card-shell p-4.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Total Tax / GST Collected</span>
              <div className="mono mt-1 text-2xl font-bold text-primary">
                ₹{salesMetrics.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-muted-foreground">Output tax collected</span>
            </div>
            <div className="card-shell p-4.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Applicable Tax Configuration</span>
              <div className="mt-1 text-lg font-bold text-foreground">
                {taxSettings.enable_tax ? `${taxSettings.tax_name} (${taxSettings.tax_rate}%)` : 'Tax Disabled'}
              </div>
              <span className="text-[11px] text-muted-foreground">Configured in workspace settings</span>
            </div>
          </div>

          <div className="card-shell p-5">
            <h3 className="text-sm font-extrabold text-foreground mb-1">Tax Liability Breakdown</h3>
            <p className="text-xs text-muted-foreground mb-4">Estimated CGST / SGST split for standard intra-state filings.</p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-semibold text-muted-foreground">CGST (Central Tax - 50%)</span>
                <div className="mono mt-1 text-xl font-bold text-foreground">
                  ₹{(salesMetrics.totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-semibold text-muted-foreground">SGST (State Tax - 50%)</span>
                <div className="mono mt-1 text-xl font-bold text-foreground">
                  ₹{(salesMetrics.totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 5: PROFIT & LOSS ===================== */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          <div className="card-shell p-5 sm:p-6">
            <h3 className="text-base font-extrabold text-foreground mb-1">Financial Statement & Profit/Loss Audit</h3>
            <p className="text-xs text-muted-foreground mb-6">Consolidated income statement for period: {dateRange.start} to {dateRange.end}</p>

            <div className="space-y-3 divide-y divide-border/60">
              {/* Income */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-sm font-bold text-foreground">1. Gross Revenue (Billed Sales)</span>
                  <p className="text-[11px] text-muted-foreground">Total invoices generated</p>
                </div>
                <span className="mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  + ₹{pnlMetrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* COGS */}
              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="text-sm font-bold text-foreground">2. Cost of Goods Sold (COGS)</span>
                  <p className="text-[11px] text-muted-foreground">Inventory cost of items sold</p>
                </div>
                <span className="mono text-sm font-bold text-destructive">
                  - ₹{pnlMetrics.estimatedCOGS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Gross Profit */}
              <div className="flex items-center justify-between pt-3 bg-muted/30 p-2.5 rounded-lg">
                <div>
                  <span className="text-sm font-extrabold text-foreground">Gross Profit</span>
                  <p className="text-[11px] text-muted-foreground">Revenue minus product costs</p>
                </div>
                <span className="mono text-base font-extrabold text-foreground">
                  ₹{pnlMetrics.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Operating Expenses */}
              <div className="flex items-center justify-between pt-3">
                <div>
                  <span className="text-sm font-bold text-foreground">3. Operating Expenses</span>
                  <p className="text-[11px] text-muted-foreground">Rent, salaries, shipping, electricity, etc.</p>
                </div>
                <span className="mono text-sm font-bold text-destructive">
                  - ₹{pnlMetrics.totalExpensesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Net Operating Profit */}
              <div className="flex items-center justify-between pt-4 bg-primary/10 p-3.5 rounded-xl border border-primary/20">
                <div>
                  <span className="text-base font-extrabold text-primary">Net Operating Profit</span>
                  <p className="text-xs text-muted-foreground">Bottom line profitability ({pnlMetrics.netProfitMargin.toFixed(1)}% margin)</p>
                </div>
                <span className="mono text-xl font-black text-primary">
                  ₹{pnlMetrics.netOperatingProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
