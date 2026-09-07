import React, { useState, useEffect } from 'react';
import {
  X, Download, FileSpreadsheet, Calendar,
  Layers, ShieldCheck, RefreshCw
} from 'lucide-react';
import {
  aggregateCAExportData,
  generateCAExportWorkbook,
  generateCACSVExport,
  getFinancialYearDates,
  getQuarterDates,
  CAExportSummary
} from '@/services/caExportEngine';
import { toast } from 'sonner';
import { useBodyScrollLock } from '@/lib/useScrollReset';

interface CATaxExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
}

export function CATaxExportModal({ isOpen, onClose, businessName = 'BillingMaster Enterprise' }: CATaxExportModalProps) {
  useBodyScrollLock(isOpen);
  const [financialYear, setFinancialYear] = useState<string>('2025 - 2026');
  const [periodPreset, setPeriodPreset] = useState<'FULL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'CUSTOM'>('FULL');
  const [startDate, setStartDate] = useState<string>('2025-04-01');
  const [endDate, setEndDate] = useState<string>('2026-03-31');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  
  const [isAggregating, setIsAggregating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [dataSummary, setDataSummary] = useState<CAExportSummary | null>(null);
  const [activePreviewSheet, setActivePreviewSheet] = useState<string>('Daily_Sales_Summary');

  // Sync dates when Financial Year or Period preset changes
  useEffect(() => {
    if (periodPreset === 'FULL') {
      const dates = getFinancialYearDates(financialYear);
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
    } else if (periodPreset === 'CUSTOM') {
      // Keep custom dates
    } else {
      const dates = getQuarterDates(financialYear, periodPreset);
      setStartDate(dates.startDate);
      setEndDate(dates.endDate);
    }
  }, [financialYear, periodPreset]);

  // Load preview data whenever start/end dates change
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsAggregating(true);
      try {
        const summary = await aggregateCAExportData({ startDate, endDate });
        if (isMounted) {
          setDataSummary(summary);
        }
      } catch (err) {
        console.error('Error calculating export summary:', err);
      } finally {
        if (isMounted) {
          setIsAggregating(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!dataSummary) return;
    setIsDownloading(true);
    try {
      // Simulate real aggregation delay for UX feedback
      await new Promise(r => setTimeout(r, 600));

      const periodLabel = periodPreset === 'FULL'
        ? `FY ${financialYear}`
        : `${periodPreset} (${startDate} to ${endDate})`;

      if (exportFormat === 'xlsx') {
        generateCAExportWorkbook(dataSummary, {
          businessName,
          fy: financialYear,
          dateRangeText: periodLabel
        });
        toast.success(`CA Audit Excel Workbook (.xlsx) generated with 5 sheets!`);
      } else {
        generateCACSVExport(dataSummary, {
          fy: financialYear.replace(/\s+/g, '_'),
          sheetName: activePreviewSheet
        });
        toast.success(`Downloaded ${activePreviewSheet} as CSV!`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate export file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="card-shell w-full max-w-4xl p-0 my-auto shadow-2xl border border-border overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-foreground">Export for CA / Tax Audit</h3>
                <span className="inline-flex items-center whitespace-nowrap rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold px-2 py-0.5">
                  5-Sheet Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                Multi-sheet financial audit pack for GST, ITR & Balance Sheets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Close Modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* 1. Date Range & Configuration Card */}
          <div className="bg-muted/40 p-4 sm:p-5 rounded-2xl border border-border/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  <span>Select Audit Period & Financial Year</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">Filter sales, purchases, GST and expenses by standard FY or quarter</p>
              </div>

              {/* Financial Year Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs font-bold text-foreground shrink-0">FY:</label>
                <select
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-xs"
                >
                  <option value="2025 - 2026">2025 - 2026 (Current)</option>
                  <option value="2024 - 2025">2024 - 2025</option>
                  <option value="2023 - 2024">2023 - 2024</option>
                  <option value="2026 - 2027">2026 - 2027</option>
                </select>
              </div>
            </div>

            {/* Period Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { id: 'FULL', label: 'Full FY (12M)' },
                { id: 'Q1', label: 'Q1 (Apr–Jun)' },
                { id: 'Q2', label: 'Q2 (Jul–Sep)' },
                { id: 'Q3', label: 'Q3 (Oct–Dec)' },
                { id: 'Q4', label: 'Q4 (Jan–Mar)' },
                { id: 'CUSTOM', label: 'Custom Dates' }
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPeriodPreset(preset.id as any)}
                  className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold text-center transition-all cursor-pointer whitespace-nowrap ${
                    periodPreset === preset.id
                      ? 'bg-primary text-primary-foreground shadow-xs font-extrabold ring-2 ring-primary/20'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card/70'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Audit Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriodPreset('CUSTOM');
                  }}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Audit End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriodPreset('CUSTOM');
                  }}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* 2. Export Format Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              onClick={() => setExportFormat('xlsx')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                exportFormat === 'xlsx'
                  ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-border bg-card hover:bg-muted/30'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                checked={exportFormat === 'xlsx'}
                onChange={() => setExportFormat('xlsx')}
                className="mt-1 h-4 w-4 accent-emerald-600"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-foreground">Excel Workbook (.xlsx)</span>
                  <span className="text-[9px] font-black uppercase bg-emerald-600 text-white px-1.5 py-0.2 rounded">Recommended</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Single workbook with 5 dedicated sheets, styled headers, and automatic summary calculation rows.
                </p>
              </div>
            </label>

            <label
              onClick={() => setExportFormat('csv')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                exportFormat === 'csv'
                  ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-card hover:bg-muted/30'
              }`}
            >
              <input
                type="radio"
                name="exportFormat"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-foreground">CSV Text Format (.csv)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Direct plain-text CSV export of the currently active selected sheet for tally, ERP or legacy software imports.
                </p>
              </div>
            </label>
          </div>

          {/* 3. Included Audit Worksheets Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers size={14} className="text-primary" />
                <span>5 Generated Audit Sheets & Aggregated Metrics</span>
              </h4>
              {isAggregating && (
                <span className="text-[11px] text-primary flex items-center gap-1 font-bold animate-pulse">
                  <RefreshCw size={12} className="animate-spin" /> Aggregating live store data...
                </span>
              )}
            </div>

            {/* Sheet Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              
              {/* Sheet 1 */}
              <div
                onClick={() => setActivePreviewSheet('Daily_Sales_Summary')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activePreviewSheet === 'Daily_Sales_Summary'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">Sheet 1</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{dataSummary?.dailySales.length || 0} Days Logged</span>
                </div>
                <h5 className="text-xs font-extrabold text-foreground">Daily_Sales_Summary</h5>
                <p className="text-[11px] text-muted-foreground mt-1">Date, Total Orders, Revenue, Cash vs UPI collection, Total Tax.</p>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground text-[11px]">Total Revenue:</span>
                  <span className="font-extrabold text-foreground">₹{(dataSummary?.totals.totalRevenue || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Sheet 2 */}
              <div
                onClick={() => setActivePreviewSheet('GST_Tax_Breakdown')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activePreviewSheet === 'GST_Tax_Breakdown'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">Sheet 2</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{dataSummary?.gstBreakdown.length || 0} Months</span>
                </div>
                <h5 className="text-xs font-extrabold text-foreground">GST_Tax_Breakdown</h5>
                <p className="text-[11px] text-muted-foreground mt-1">Monthly 0%, 5%, 12%, 18% taxable sales, CGST, SGST & total tax.</p>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground text-[11px]">GST Collected:</span>
                  <span className="font-extrabold text-blue-600">₹{(dataSummary?.totals.totalGSTCollected || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Sheet 3 */}
              <div
                onClick={() => setActivePreviewSheet('Purchase_Register')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activePreviewSheet === 'Purchase_Register'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">Sheet 3</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{dataSummary?.purchaseRegister.length || 0} Purchases</span>
                </div>
                <h5 className="text-xs font-extrabold text-foreground">Purchase_Register</h5>
                <p className="text-[11px] text-muted-foreground mt-1">Vendor name, GSTIN, Invoice #, Taxable value, ITC tax paid.</p>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground text-[11px]">Claimable ITC:</span>
                  <span className="font-extrabold text-emerald-600">₹{(dataSummary?.totals.totalITCClaimable || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Sheet 4 */}
              <div
                onClick={() => setActivePreviewSheet('Expense_&_Salary')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activePreviewSheet === 'Expense_&_Salary'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Sheet 4</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{dataSummary?.expenses.length || 0} Records</span>
                </div>
                <h5 className="text-xs font-extrabold text-foreground">Expense_&_Salary</h5>
                <p className="text-[11px] text-muted-foreground mt-1">Payroll, Rent, Utilities, Transport grouped by category & payment mode.</p>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground text-[11px]">Total Expenses:</span>
                  <span className="font-extrabold text-amber-600">₹{(dataSummary?.totals.totalExpenses || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Sheet 5 */}
              <div
                onClick={() => setActivePreviewSheet('Debtors_&_Creditors')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer sm:col-span-2 md:col-span-2 ${
                  activePreviewSheet === 'Debtors_&_Creditors'
                    ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-500/10 px-1.5 py-0.5 rounded">Sheet 5</span>
                  <span className="text-[10px] font-bold text-muted-foreground">{dataSummary?.debtorsCreditors.length || 0} Accounts</span>
                </div>
                <h5 className="text-xs font-extrabold text-foreground">Debtors_&_Creditors</h5>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Section A: Pending Customer Khata/Udhar balances (Debtors) | Section B: Unpaid Supplier trade credits (Creditors).
                </p>
                <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-between items-center text-xs">
                  <span className="text-muted-foreground text-[11px]">Customer Receivables: ₹{(dataSummary?.totals.totalCustomerDues || 0).toLocaleString()}</span>
                  <span className="text-muted-foreground text-[11px]">Supplier Payables: <strong className="text-purple-600">₹{(dataSummary?.totals.totalSupplierDues || 0).toLocaleString()}</strong></span>
                </div>
              </div>

            </div>
          </div>

          {/* Audit Quality Assurance Note */}
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-foreground">CA-Ready Standard Compliance</p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Output sheets adhere to standard GST return schemas (GSTR-1, GSTR-3B) and Schedule III Balance Sheet audit formatting.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <span>Period: <strong>{startDate}</strong> to <strong>{endDate}</strong></span>
            <span className="mx-2">•</span>
            <span>Target: <strong>{exportFormat.toUpperCase()}</strong></span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDownloading || isAggregating}
              onClick={handleDownload}
              className="flex-1 sm:flex-none btn-primary px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Building Workbook...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Generate & Download Report</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

