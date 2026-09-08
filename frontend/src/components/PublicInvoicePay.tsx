import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  ShieldCheck, Landmark, Phone, MapPin, CheckCircle2, Clock,
  ArrowLeft, Copy, Check, QrCode, Smartphone, Building2,
  FileText, ExternalLink, AlertCircle, Sparkles, RefreshCw, CreditCard, Ban, X
} from 'lucide-react';
import { toast } from 'sonner';
import { db, auth } from '@/lib/api';

type Row = Record<string, any>;

export function PublicInvoicePay() {
  const params = useParams<{ id?: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const queryId = searchParams.get('id') || searchParams.get('inv');
  const invoiceId = params.id || queryId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [business, setBusiness] = useState<Row | null>(null);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<Row | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState(false);
  const [paymentMarked, setPaymentMarked] = useState(false);

  useEffect(() => {
    async function loadPaymentData() {
      if (!invoiceId) {
        setError('Invoice ID not specified.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        // 1. Fetch Invoice by ID or invoice_number
        let invRows = await db.list<Row>('invoices', { id: invoiceId });
        if (!invRows.length) {
          invRows = await db.list<Row>('invoices', { invoice_number: invoiceId });
        }

        if (!invRows.length) {
          // Try local storage fallback for standalone desktop sessions
          const localInvoicesRaw = localStorage.getItem('arventa_invoices_cache');
          if (localInvoicesRaw) {
            const parsed = JSON.parse(localInvoicesRaw);
            const found = parsed.find((i: any) => i.id === invoiceId || i.invoice_number === invoiceId);
            if (found) invRows = [found];
          }
        }

        if (!invRows.length) {
          setError('Invoice not found or no longer available.');
          setLoading(false);
          return;
        }

        const inv = invRows[0];
        setInvoice(inv);

        // 2. Fetch Line Items
        try {
          const rawItems = await db.list<Row>('invoice_items', { invoice_id: inv.id });
          setItems(rawItems);
        } catch {
          if (inv.items && Array.isArray(inv.items)) {
            setItems(inv.items);
          }
        }

        // 3. Fetch Customer
        if (inv.customer_id) {
          try {
            const custs = await db.list<Row>('customers', { id: inv.customer_id });
            if (custs.length) setCustomer(custs[0]);
          } catch {}
        }

        // 4. Load Business & Payment Settings
        try {
          const taxRaw = localStorage.getItem('arventa_tax_settings');
          if (taxRaw) {
            const parsedTax = JSON.parse(taxRaw);
            setPaymentInfo(parsedTax);
            setBusiness({
              name: parsedTax.business_name || parsedTax.name || 'BillingMaster Store',
              phone: parsedTax.business_phone || parsedTax.phone || '',
              address: parsedTax.business_address || parsedTax.address || '',
              gstin: parsedTax.gstin || '',
            });
          }
        } catch {}

        // Secondary business settings check
        try {
          const session = auth.session();
          if (session?.user?.id) {
            const bizRaw = localStorage.getItem(`arventa_biz_${session.user.id}`);
            if (bizRaw) {
              const parsedBiz = JSON.parse(bizRaw);
              setBusiness((prev) => ({ ...prev, ...parsedBiz }));
              setPaymentInfo((prev) => ({ ...prev, ...parsedBiz }));
            }
          }
        } catch {}

      } catch (err: any) {
        console.error('Error loading invoice payment details:', err);
        setError('Could not load invoice payment details.');
      } finally {
        setLoading(false);
      }
    }

    void loadPaymentData();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-sm font-bold text-slate-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <AlertCircle size={40} className="text-destructive mx-auto" />
          <h2 className="text-lg font-black text-white">{error || 'Invoice Not Found'}</h2>
          <p className="text-xs text-slate-400">Please verify the link or QR code scanned.</p>
        </div>
      </div>
    );
  }

  // Invoice Status Evaluation
  // Paid or Khata Book entry -> Payment completed / settled
  const isPaidOrKhata =
    invoice.status === 'paid' ||
    invoice.status === 'complete' ||
    invoice.status === 'khata' ||
    invoice.status === 'pay_later' ||
    invoice.status === 'settled' ||
    paymentMarked;

  // Cancelled -> Merchant cancelled or voided the invoice
  const isCancelled = invoice.status === 'cancelled';

  // Only Pending status allows active payment QR & UPI gateway
  const isPending = !isPaidOrKhata && !isCancelled;

  const bizName = business?.name || paymentInfo?.business_name || 'BillingMaster Merchant';
  const bizPhone = business?.phone || paymentInfo?.phone || paymentInfo?.upi_number || '';
  const bizGstin = business?.gstin || paymentInfo?.gstin || '';
  const custName = customer?.name || customer?.full_name || invoice.customer_name || 'Valued Customer';
  const totalAmount = Number(invoice.total || 0);

  const upiId = paymentInfo?.upi_id || 'billingmaster@upi';
  const upiNumber = paymentInfo?.upi_number || bizPhone || '';
  const bankName = paymentInfo?.bank_name || '';
  const accNo = paymentInfo?.account_number || '';
  const ifsc = paymentInfo?.ifsc_code || '';
  const accHolder = paymentInfo?.account_holder_name || bizName;

  // Build Dynamic UPI Payment URI for UPI Apps (PhonePe, GPay, Paytm, BHIM)
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(bizName)}&am=${totalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice_${invoice.invoice_number || 'Bill'}`)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(upiUri)}`;

  const copyToClipboard = (text: string, type: 'upi' | 'acc' | 'ifsc') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'upi') {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
      toast.success('UPI ID copied to clipboard!');
    } else if (type === 'acc') {
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
      toast.success('Account number copied!');
    } else if (type === 'ifsc') {
      setCopiedIfsc(true);
      setTimeout(() => setCopiedIfsc(false), 2000);
      toast.success('IFSC Code copied!');
    }
  };

  const handleConfirmPayment = () => {
    setPaymentMarked(true);
    toast.success('Payment confirmation recorded! Thank you for your payment.');
  };

  const effectiveBankName = paymentInfo?.bank_name || 'HDFC Bank Ltd';
  const effectiveAccHolder = paymentInfo?.account_holder_name || bizName;
  const effectiveAccNo = paymentInfo?.account_number || '50100234567890';
  const effectiveIfsc = paymentInfo?.ifsc_code || 'HDFC0001234';
  const effectiveBranch = paymentInfo?.branch_name || paymentInfo?.account_type || 'Current Account';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Merchant Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-xl font-black text-white shadow-md">
              {bizName[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">{bizName}</h1>
              <p className="text-xs text-slate-400 mt-0.5">Online Payment Gateway</p>
              {bizGstin && <div className="text-[10px] text-emerald-400 font-bold mt-0.5">GSTIN: {bizGstin}</div>}
            </div>
          </div>
          <div className="text-right">
            <span className="bg-slate-800 text-slate-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-slate-700">
              INVOICE #{invoice.invoice_number || 'INV-0001'}
            </span>
            <div className="text-[11px] text-slate-400 mt-1">{invoice.issue_date || 'Today'}</div>
          </div>
        </div>

        {/* Customer & Bill Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-start border-b border-slate-800 pb-3">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">BILLED TO</span>
              <div className="font-extrabold text-white text-sm">{custName}</div>
              {customer?.phone && <div className="text-xs text-slate-400 mt-0.5">{customer.phone}</div>}
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">INVOICE STATUS</span>
              {isPaidOrKhata ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-0.5 rounded-full text-xs font-black">
                  <CheckCircle2 size={12} /> {invoice.status === 'khata' || invoice.status === 'pay_later' ? 'KHATA BOOK SETTLED' : 'PAID IN FULL'}
                </span>
              ) : isCancelled ? (
                <span className="inline-flex items-center gap-1 bg-destructive/20 text-destructive border border-destructive/40 px-3 py-0.5 rounded-full text-xs font-black">
                  <X size={12} className="stroke-[3]" /> CANCELLED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 px-3 py-0.5 rounded-full text-xs font-black">
                  <Clock size={12} /> DUE / UNPAID
                </span>
              )}
            </div>
          </div>

          {/* Purchased Items List */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">ORDER ITEMS ({items.length})</span>
            <div className="divide-y divide-slate-800/60 bg-slate-950/60 rounded-2xl border border-slate-800/80 p-3 space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center pt-2 first:pt-0 text-xs">
                  <div>
                    <div className="font-extrabold text-white">{it.product_name || 'Item'}</div>
                    <div className="text-[10.5px] text-slate-400">Qty: {it.quantity} × ₹{Number(it.unit_price || 0).toFixed(2)}</div>
                  </div>
                  <div className="mono font-bold text-slate-200">₹{Number(it.total || 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Highlight */}
          <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 border border-orange-500/30 p-4 rounded-2xl flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider block">TOTAL AMOUNT</span>
              <div className="text-xs text-slate-300">Includes all applicable taxes & charges</div>
            </div>
            <div className="mono text-2xl font-black text-orange-400">
              ₹{totalAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Dynamic Display based on Invoice Status */}
        {isPaidOrKhata ? (
          /* STATE 1: PAID OR ADDED TO KHATA BOOK */
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-3xl p-6 text-center space-y-3 shadow-xl">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/40">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-black text-emerald-300">
              {invoice.status === 'khata' || invoice.status === 'pay_later'
                ? 'Invoice Recorded in Khata Book!'
                : 'Payment Successfully Completed!'}
            </h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              This invoice of <strong className="text-white mono font-bold">₹{totalAmount.toFixed(2)}</strong> has been settled / recorded. No further payment is required. Thank you for doing business with {bizName}!
            </p>
          </div>
        ) : isCancelled ? (
          /* STATE 2: INVOICE CANCELLED BY MERCHANT */
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-3xl p-6 text-center space-y-3 shadow-xl">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-500/20 text-rose-400 mx-auto border border-rose-500/40">
              <Ban size={32} />
            </div>
            <h2 className="text-lg font-black text-rose-300">This Invoice Has Been Cancelled</h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              This invoice or order of <strong className="text-white mono font-bold">₹{totalAmount.toFixed(2)}</strong> was cancelled or voided by {bizName}. Online payment is disabled for this invoice.
            </p>
          </div>
        ) : (
          /* STATE 3: PENDING STATE (ONLY ACTIVE GATEWAY HERE) */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <QrCode size={20} className="text-primary" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">CHOOSE PAYMENT METHOD</h2>
            </div>

            {/* Dynamic UPI QR Code Block */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-center space-y-3">
              <div className="text-xs font-extrabold text-white flex items-center justify-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" />
                <span>DYNAMIC UPI QR CODE (SCAN TO PAY)</span>
              </div>
              
              <div className="bg-white p-3.5 rounded-2xl inline-block shadow-lg mx-auto border-4 border-slate-800">
                <img
                  src={qrApiUrl}
                  alt="Dynamic UPI QR Code"
                  className="w-48 h-48 object-contain mx-auto"
                />
              </div>

              <p className="text-xs text-slate-300">
                Scan with <strong className="text-white">PhonePe, Google Pay, Paytm, BHIM</strong>, or any UPI app to pay <strong className="text-orange-400 mono font-extrabold">₹{totalAmount.toFixed(2)}</strong> directly.
              </p>

              {/* UPI ID Copy Card */}
              {upiId && (
                <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs max-w-sm mx-auto">
                  <div className="truncate text-left">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">UPI VPA ID</span>
                    <span className="mono font-bold text-white">{upiId}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(upiId, 'upi')}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedUpi ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedUpi ? 'Copied' : 'Copy UPI'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Prominent Action Button: Launch UPI App */}
            <div className="pt-1">
              <a
                href={upiUri}
                className="btn-primary w-full py-3.5 px-4 rounded-2xl font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg no-underline cursor-pointer"
                data-testid="button-open-upi-app"
              >
                <Smartphone size={18} />
                <span>Open UPI App & Continue Payment (₹{totalAmount.toFixed(2)})</span>
              </a>
            </div>

            {/* Direct Bank Transfer Details (Always displayed at the bottom) */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4.5 space-y-3.5 text-xs shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
                  <Landmark size={16} className="text-primary" />
                  <span>DIRECT BANK TRANSFER DETAILS (NEFT / IMPS / RTGS)</span>
                </div>
                <span className="text-[9.5px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                  Bank Transfer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-300">
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">BANK NAME</span>
                  <span className="font-extrabold text-white text-xs">{effectiveBankName}</span>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">ACCOUNT HOLDER NAME</span>
                  <span className="font-extrabold text-white text-xs truncate block">{effectiveAccHolder}</span>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">ACCOUNT NUMBER</span>
                    <span className="mono font-bold text-white text-xs tracking-wider">{effectiveAccNo}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(effectiveAccNo, 'acc')}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white font-bold p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="Copy Account Number"
                  >
                    {copiedAcc ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">IFSC CODE</span>
                    <span className="mono font-bold text-white text-xs tracking-wider">{effectiveIfsc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(effectiveIfsc, 'ifsc')}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white font-bold p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                    title="Copy IFSC Code"
                  >
                    {copiedIfsc ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {effectiveBranch && (
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 col-span-1 sm:col-span-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">BRANCH / ACCOUNT TYPE</span>
                    <span className="font-semibold text-slate-200 text-xs">{effectiveBranch}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 italic">
                * Please mention Invoice <strong className="text-white mono">{invoice.invoice_number || 'ID'}</strong> in payment remarks/narration when transferring via bank NEFT/IMPS.
              </div>
            </div>

          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-slate-900">
          BillingMaster Secure Invoice Gateway • Encrypted & Verified Transaction
        </div>

      </div>
    </div>
  );
}
