import React from 'react';
import {
  Phone, MapPin, ShieldCheck, Landmark, Check, Clock, X,
  Building2, Crown, Cpu, Sparkles, Ticket, QrCode, FileText, CheckCircle2,
  ExternalLink, Barcode
} from 'lucide-react';
import { InvoiceTemplateId, InvoiceTemplateSettings } from './InvoiceTemplateModal';

const CODE39_MAP: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
  '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
  'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000',
  'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010',
  'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
  'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000',
  'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

export function InvoiceBarcode({
  value = '',
  height = 36,
  showText = true,
  className = ''
}: {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}) {
  const cleanVal = (value || 'INV-0001').toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '') || 'INV-0001';
  const encodedText = `*${cleanVal}*`;

  let totalWidth = 0;
  const elements: { isBar: boolean; width: number; x: number }[] = [];

  for (let i = 0; i < encodedText.length; i++) {
    const char = encodedText[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP['-'];
    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === '1';
      const width = isWide ? 3 : 1;
      elements.push({ isBar, width, x: totalWidth });
      totalWidth += width;
    }
    // Inter-character space
    elements.push({ isBar: false, width: 1, x: totalWidth });
    totalWidth += 1;
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-auto max-h-12"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {elements.map((el, idx) =>
          el.isBar ? (
            <rect key={idx} x={el.x} y={0} width={el.width} height={height} fill="#000000" />
          ) : null
        )}
      </svg>
      {showText && (
        <span className="mono font-mono font-bold text-[10px] tracking-wider text-slate-800 mt-0.5">
          {cleanVal}
        </span>
      )}
    </div>
  );
}

interface InvoiceDocumentSheetProps {
  invoice: any;
  business: any;
  customer: any;
  items: any[];
  paymentInfo: any;
  templateSettings: InvoiceTemplateSettings;
  isPaid: boolean;
  timeStr?: string;
  notifString?: string;
}

export function InvoiceDocumentSheet({
  invoice,
  business,
  customer,
  items,
  paymentInfo,
  templateSettings,
  isPaid,
  timeStr = '',
  notifString = '',
}: InvoiceDocumentSheetProps) {
  const activeTplId: InvoiceTemplateId = templateSettings?.template_id || 'standard';
  const printSize = templateSettings?.print_size || 'A4';

  const subtotal = Number(invoice?.total || items.reduce((acc, it) => acc + (Number(it.total) || (Number(it.quantity || 1) * Number(it.unit_price || 0))), 0));
  const hasTax = Boolean(business?.gstin || paymentInfo?.gstin || activeTplId === 'gst-pro' || activeTplId === 'b2b-enterprise');
  
  // Tax calculations for GST templates
  const taxableVal = hasTax ? subtotal / 1.18 : subtotal;
  const cgstVal = hasTax ? (subtotal - taxableVal) / 2 : 0;
  const sgstVal = hasTax ? (subtotal - taxableVal) / 2 : 0;

  const bizName = business?.name || 'BillingMaster Store';
  const bizPhone = business?.phone || paymentInfo?.upi_number || '';
  const bizAddress = business?.address || '';
  const bizGstin = business?.gstin || paymentInfo?.gstin || '';
  const custName = customer?.name || customer?.full_name || 'Walk-in Customer';
  const custPhone = customer?.phone || '';
  const custAddress = customer?.address || '';
  const invNumber = invoice?.invoice_number || 'INV-0001';
  const invDate = invoice?.issue_date || 'Today';

  // Public Payment Page URL encoded in the QR code
  const paymentPageUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pay/${invoice?.id || invNumber}`
    : `https://billingmaster.app/pay/${invoice?.id || invNumber}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentPageUrl)}`;

  // Interactive Online Payment QR & Invoice Barcode Block
  const renderOnlinePaymentQrBlock = () => (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200 text-xs">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <a
          href={paymentPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-white p-1 rounded border border-slate-300 hover:opacity-90 transition-opacity"
          title="Scan or click to open online payment page"
        >
          <img src={qrImageUrl} alt="Scan to Pay Online" className="w-16 h-16 object-contain" />
        </a>
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1 text-[9.5px] font-black text-slate-800 uppercase tracking-wider">
            <QrCode size={12} className="text-orange-600" />
            <span>ONLINE PAYMENT & BILL QR</span>
          </div>
          <div className="text-[10.5px] font-extrabold text-slate-900 leading-tight">
            Scan QR Code to Pay Online or View Bill
          </div>
          <div className="text-[9.5px] text-slate-500 truncate">
            Instant UPI Apps (GPay, PhonePe, Paytm) & Bank Transfer
          </div>
          <a
            href={paymentPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9.5px] font-extrabold text-orange-600 hover:underline flex items-center gap-0.5 mt-0.5 no-underline truncate"
          >
            <span className="truncate">{paymentPageUrl}</span>
            <ExternalLink size={9} className="shrink-0" />
          </a>
        </div>
      </div>

      {/* Invoice Barcode Block */}
      <div className="shrink-0 flex flex-col items-center justify-center p-2 rounded border border-slate-300/80 bg-white text-center sm:border-l sm:pl-3">
        <div className="text-[8.5px] font-black text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Barcode size={12} className="text-slate-800" />
          <span>INVOICE BARCODE</span>
        </div>
        <InvoiceBarcode value={invNumber} height={32} className="max-w-[170px]" />
      </div>
    </div>
  );

  // Bank & UPI block helper
  const renderBankDetails = () => (
    <div className="space-y-2.5">
      {/* Online Payment QR Code Block */}
      {renderOnlinePaymentQrBlock()}

      {/* Bank Details */}
      {Boolean(paymentInfo?.upi_id || paymentInfo?.bank_name || paymentInfo?.account_number) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1.5">
            <Landmark size={12} className="text-slate-600" />
            <span>PAYMENT DETAILS / BANK TRANSFER</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {paymentInfo?.upi_id && (
              <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                <span className="font-semibold text-slate-500">UPI ID:</span>
                <span className="mono font-bold text-slate-900">{paymentInfo.upi_id}</span>
              </div>
            )}
            {paymentInfo?.upi_number && (
              <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                <span className="font-semibold text-slate-500">UPI Mobile:</span>
                <span className="mono font-bold text-slate-900">{paymentInfo.upi_number}</span>
              </div>
            )}
            {paymentInfo?.bank_name && (
              <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                <span className="font-semibold text-slate-500">Bank Name:</span>
                <span className="font-bold text-slate-900">{paymentInfo.bank_name}</span>
              </div>
            )}
            {paymentInfo?.account_number && (
              <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                <span className="font-semibold text-slate-500">A/C No:</span>
                <span className="mono font-bold text-slate-900">{paymentInfo.account_number}</span>
              </div>
            )}
            {paymentInfo?.ifsc_code && (
              <div className="flex justify-between border-b border-slate-200/50 pb-0.5">
                <span className="font-semibold text-slate-500">IFSC Code:</span>
                <span className="mono font-bold text-slate-900">{paymentInfo.ifsc_code}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Footer seal helper
  const renderSignatureSeal = (title = 'Authorized Seal & Signatory') => {
    const showSig = templateSettings?.show_signature !== false;
    const sigUrl = templateSettings?.signature_image_url;

    return (
      <div className="text-right shrink-0">
        {showSig && sigUrl ? (
          <div className="mb-1 flex justify-end">
            <img
              src={sigUrl}
              alt="Authorized Digital Signature"
              className="h-16 sm:h-20 max-w-[240px] min-h-[50px] object-contain"
            />
          </div>
        ) : (
          <div className="h-8 border-b border-slate-400 w-36 ml-auto mb-1" />
        )}
        <div className="font-bold text-xs text-slate-800">{title}</div>
      </div>
    );
  };

  /* =========================================================================
     1. GST TAX PRO TEMPLATE
     ========================================================================= */
  if (activeTplId === 'gst-pro') {
    return (
      <div className="space-y-4 text-slate-900 text-xs">
        {/* Header Banner */}
        <div className="bg-emerald-800 text-white p-4 sm:p-5 rounded-t-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-300" />
              <span>GST TAX INVOICE (FULL COMPLIANCE)</span>
            </div>
            <p className="text-[11px] text-emerald-200 font-bold mt-0.5">
              {bizName} • GSTIN: {bizGstin || '19ABCDE1234F1Z5'}
            </p>
          </div>
          <div className="text-left sm:text-right bg-emerald-900/60 p-2.5 rounded border border-emerald-600/50 text-[11px]">
            <div className="mono font-black text-white text-sm">{invNumber}</div>
            <div className="text-emerald-200 mt-0.5">{invDate} {timeStr ? `• ${timeStr}` : ''}</div>
            <div className="text-[10px] font-extrabold text-emerald-300 mt-0.5">State Code: 19 (West Bengal)</div>
          </div>
        </div>

        {/* Supplier & Customer Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
          <div>
            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block mb-1">SUPPLIER DETAILS</span>
            <div className="font-extrabold text-slate-900 text-sm">{bizName}</div>
            {bizPhone && <div className="flex items-center gap-1 text-[11px] mt-0.5"><Phone size={11} /> {bizPhone}</div>}
            {bizAddress && <div className="flex items-center gap-1 text-[11px] mt-0.5"><MapPin size={11} /> {bizAddress}</div>}
            {bizGstin && <div className="text-[11px] font-bold text-emerald-800 mt-1">GSTIN: {bizGstin}</div>}
          </div>
          <div>
            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block mb-1">BILLED TO (RECIPIENT)</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName}</div>
            {custPhone && <div className="flex items-center gap-1 text-[11px] mt-0.5"><Phone size={11} /> {custPhone}</div>}
            {custAddress && <div className="flex items-center gap-1 text-[11px] mt-0.5"><MapPin size={11} /> {custAddress}</div>}
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold">
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Reverse Charge: NO</span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Place of Supply: WB (19)</span>
            </div>
          </div>
        </div>

        {/* GST Itemized Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full text-left text-xs">
            <thead className="bg-emerald-800 text-white font-black text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2 px-2.5 text-center w-8">#</th>
                <th className="py-2 px-2.5">Item Description</th>
                <th className="py-2 px-2 text-center w-16">HSN</th>
                <th className="py-2 px-2 text-center w-14">Qty</th>
                <th className="py-2 px-2 text-right w-20">Rate</th>
                <th className="py-2 px-2 text-right w-20">CGST (9%)</th>
                <th className="py-2 px-2 text-right w-20">SGST (9%)</th>
                <th className="py-2 px-2.5 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {items.map((it, idx) => {
                const qty = Number(it.quantity || 1);
                const price = Number(it.unit_price || 0);
                const itemTot = Number(it.total || (qty * price));
                const itemTaxable = itemTot / 1.18;
                const itemCgst = (itemTot - itemTaxable) / 2;
                return (
                  <tr key={it.id || idx} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                    <td className="py-2 px-2 text-center mono text-slate-600">{it.hsn_code || '8471'}</td>
                    <td className="py-2 px-2 text-center font-semibold">{qty} {it.product_unit || 'pcs'}</td>
                    <td className="py-2 px-2 text-right mono">₹{price.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right mono text-slate-600">₹{itemCgst.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right mono text-slate-600">₹{itemCgst.toFixed(2)}</td>
                    <td className="py-2 px-2.5 text-right mono font-extrabold text-slate-900">₹{itemTot.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* GST Audit Breakdown & Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {renderBankDetails()}
          <div className="space-y-2 bg-emerald-50/70 p-3.5 rounded-lg border border-emerald-200 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Amount:</span>
              <span className="mono font-bold text-slate-900">₹{taxableVal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>CGST (9%):</span>
              <span className="mono font-bold text-slate-900">₹{cgstVal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>SGST (9%):</span>
              <span className="mono font-bold text-slate-900">₹{sgstVal.toFixed(2)}</span>
            </div>
            <div className="bg-emerald-800 text-white p-3 rounded-md flex justify-between font-black text-sm border border-emerald-900 shadow-xs">
              <span>GRAND TOTAL (INCL. GST)</span>
              <span className="mono text-emerald-200 font-extrabold text-base">₹{subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          <div>
            <p className="font-bold text-emerald-800">GST Compliant Tax Audit Invoice.</p>
            <p>Thank you for doing business with us!</p>
          </div>
          {renderSignatureSeal('Authorized GST Auditor Seal')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     2. B2B ENTERPRISE TEMPLATE
     ========================================================================= */
  if (activeTplId === 'b2b-enterprise') {
    return (
      <div className="space-y-4 text-slate-900 text-xs">
        {/* Deep Purple Header */}
        <div className="bg-purple-900 text-white p-4 sm:p-5 rounded-t-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <Building2 size={20} className="text-purple-300" />
              <span>B2B ENTERPRISE AUDIT INVOICE</span>
            </div>
            <p className="text-[11px] text-purple-200 font-bold mt-0.5">
              {bizName} • Corporate Supply Chain & Distribution
            </p>
          </div>
          <div className="text-left sm:text-right bg-purple-950 p-2.5 rounded border border-purple-700/50 text-[11px]">
            <div className="mono font-black text-purple-200 text-sm">{invNumber}</div>
            <div className="text-purple-300">PO #: PO-2026-88910</div>
            <div className="text-[10px] font-bold text-emerald-400 mt-0.5">Payment Terms: Net 15 Days</div>
          </div>
        </div>

        {/* Address Matrix (Billed vs Shipped) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
          <div className="bg-purple-50/60 p-3 rounded-lg border border-purple-200">
            <span className="text-[9px] font-black text-purple-900 uppercase tracking-wider block mb-1">BILLED TO (CORPORATE CLIENT)</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName}</div>
            {custPhone && <div className="text-[11px] mt-0.5">Phone: {custPhone}</div>}
            {custAddress && <div className="text-[11px] mt-0.5">Billing: {custAddress}</div>}
            {customer?.gstin && <div className="text-[11px] font-bold text-purple-900 mt-1">Client GSTIN: {customer.gstin}</div>}
          </div>
          <div className="bg-purple-50/60 p-3 rounded-lg border border-purple-200">
            <span className="text-[9px] font-black text-purple-900 uppercase tracking-wider block mb-1">SHIPPED TO (LOGISTICS DESTINATION)</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName} - Receiving Hub</div>
            <div className="text-[11px] mt-0.5">{custAddress || 'Central Warehouse Gate 3'}</div>
            <div className="text-[10px] font-bold text-purple-800 mt-1">Dispatch Mode: Surface Cargo Verified</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-purple-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-purple-800 text-white font-black text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2 px-2.5 text-center w-8">#</th>
                <th className="py-2 px-2.5">Description & Line Ref</th>
                <th className="py-2 px-2 text-center w-16">HSN</th>
                <th className="py-2 px-2 text-center w-14">Qty</th>
                <th className="py-2 px-2 text-right w-24">Unit Rate</th>
                <th className="py-2 px-2.5 text-right w-28">Audited Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-purple-50/50">
                  <td className="py-2 px-2.5 text-center text-purple-400 font-bold">{idx + 1}</td>
                  <td className="py-2 px-2.5 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2 px-2 text-center mono text-slate-600">{it.hsn_code || '9965'}</td>
                  <td className="py-2 px-2 text-center font-semibold">{it.quantity} {it.product_unit || 'pcs'}</td>
                  <td className="py-2 px-2 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2 px-2.5 text-right mono font-extrabold text-purple-950">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary & Sign-off */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderBankDetails()}
          <div className="bg-purple-900 text-white p-4 rounded-xl flex justify-between items-center font-black shadow-md">
            <span>AUDITED B2B TOTAL</span>
            <span className="mono text-xl text-purple-200">₹{subtotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-end justify-between border-t border-purple-200 pt-3 text-[10px] text-slate-500">
          <div>Corporate B2B Tax Audit Copy • Authorized for Interstate Settlement</div>
          {renderSignatureSeal('Corporate Seal & Executive Signatory')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. MODERN MINIMALIST TEMPLATE
     ========================================================================= */
  if (activeTplId === 'modern') {
    return (
      <div className="space-y-5 text-slate-900 text-xs">
        {/* Sleek Dark Title Banner */}
        <div className="bg-slate-950 text-white p-5 rounded-xl flex justify-between items-center shadow-md">
          <div>
            <h1 className="text-lg font-extrabold tracking-wider text-slate-100">{bizName}</h1>
            <p className="text-[11px] text-blue-400 font-semibold mt-0.5">MODERN MINIMALIST INVOICE</p>
          </div>
          <div className="text-right">
            <div className="mono text-xl font-black text-blue-400">#{invNumber}</div>
            <div className="text-[11px] text-slate-400">{invDate}</div>
          </div>
        </div>

        {/* Billed To */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-3 text-slate-700">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">BILLED TO</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName}</div>
            {custPhone && <div className="text-[11px] text-slate-500">{custPhone}</div>}
            {custAddress && <div className="text-[11px] text-slate-500">{custAddress}</div>}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">STATUS</span>
            <span className={`inline-block px-3 py-1 rounded-full font-black text-[10px] uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isPaid ? '✓ PAID ONLINE' : 'DUE / UNPAID'}
            </span>
          </div>
        </div>

        {/* Minimalist Borderless Table */}
        <div className="py-2">
          <table className="w-full text-left text-xs">
            <thead className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-900 tracking-wider">
              <tr>
                <th className="py-2 px-1 w-8">#</th>
                <th className="py-2 px-1">Description</th>
                <th className="py-2 px-1 text-center w-16">Qty</th>
                <th className="py-2 px-1 text-right w-24">Price</th>
                <th className="py-2 px-1 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50">
                  <td className="py-2.5 px-1 text-slate-400 font-bold">{idx + 1}</td>
                  <td className="py-2.5 px-1 font-extrabold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2.5 px-1 text-center font-semibold text-slate-700">{it.quantity}</td>
                  <td className="py-2.5 px-1 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-1 text-right mono font-black text-slate-900">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Card */}
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 pt-3 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 max-w-xs space-y-2">
            <div>Thank you for choosing {bizName}. Modern borderless invoice format.</div>
            {renderOnlinePaymentQrBlock()}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-right min-w-[200px]">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">GRAND TOTAL</div>
              <div className="mono text-2xl font-black text-blue-600 mt-0.5">₹{subtotal.toFixed(2)}</div>
            </div>
            {renderSignatureSeal('Authorized Signatory')}
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     4. COMPACT THERMAL POS TEMPLATE
     ========================================================================= */
  if (activeTplId === 'pos-thermal') {
    return (
      <div className="space-y-3 font-mono text-slate-900 text-xs p-2">
        <div className="text-center border-b-2 border-dashed border-slate-400 pb-2">
          <div className="font-black text-sm tracking-wider">*** {bizName.toUpperCase()} ***</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{bizAddress || 'Commercial Store'}</div>
          {bizPhone && <div className="text-[10px] text-slate-600">Tel: {bizPhone}</div>}
          <div className="text-[10px] font-bold mt-1">RECEIPT #: {invNumber}</div>
          <div className="text-[9px] text-slate-500">{invDate} {timeStr}</div>
        </div>

        {/* Item List */}
        <div className="border-b border-dashed border-slate-300 pb-2 space-y-1.5 text-[11px]">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between items-start">
              <div>
                <div className="font-bold">{it.product_name || 'Item'}</div>
                <div className="text-[9.5px] text-slate-500">{it.quantity} x ₹{Number(it.unit_price || 0).toFixed(2)}</div>
              </div>
              <div className="font-black mono">₹{Number(it.total || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Grand Total */}
        <div className="border-b-2 border-dashed border-slate-400 pb-2 space-y-1">
          <div className="flex justify-between font-black text-sm">
            <span>TOTAL PAID</span>
            <span className="mono">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Payment Mode:</span>
            <span>{invoice?.payment_method || 'CASH / UPI'}</span>
          </div>
        </div>

        {/* QR Block for POS */}
        <div className="bg-slate-100 p-2 rounded text-center border border-slate-300 space-y-1">
          <img src={qrImageUrl} alt="Scan to Pay" className="w-16 h-16 object-contain mx-auto" />
          <div className="text-[9px] font-bold">SCAN TO PAY ONLINE</div>
        </div>

        {/* Digital Signature Seal for POS */}
        <div className="flex justify-end pt-1">
          {renderSignatureSeal('Authorized Store Seal')}
        </div>

        {/* Thermal Barcode Footer */}
        <div className="text-center pt-1 space-y-1">
          <InvoiceBarcode value={invNumber} height={32} className="my-1 mx-auto" />
          <div className="text-[9px] text-slate-500">Thank you! Visit again!</div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     5. CLASSIC EXECUTIVE TEMPLATE
     ========================================================================= */
  if (activeTplId === 'executive') {
    return (
      <div className="border-4 border-double border-amber-600/80 p-5 sm:p-7 space-y-4 text-slate-900 font-serif">
        {/* Formal Header Letterhead */}
        <div className="text-center border-b-2 border-amber-600/40 pb-4">
          <h1 className="text-xl sm:text-2xl font-black text-amber-900 tracking-widest uppercase">{bizName}</h1>
          <p className="text-xs text-amber-800 font-medium italic mt-0.5">Commercial Contract & Executive Invoicing</p>
          <div className="mt-2 text-xs text-slate-600 font-sans">
            {bizAddress} • Tel: {bizPhone}
          </div>
        </div>

        {/* Contract & Client Details */}
        <div className="flex justify-between items-start text-xs font-sans border-b border-amber-200 pb-3">
          <div>
            <span className="font-serif font-bold text-amber-900 text-sm block">BILLED TO (CLIENT):</span>
            <div className="font-bold text-slate-900 text-sm">{custName}</div>
            {custAddress && <div className="text-slate-600">{custAddress}</div>}
          </div>
          <div className="text-right">
            <span className="font-serif font-bold text-amber-900 text-sm block">CONTRACT INVOICE:</span>
            <div className="mono font-bold text-slate-900 text-sm">#{invNumber}</div>
            <div className="text-slate-600">{invDate}</div>
          </div>
        </div>

        {/* Executive Table */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-50 text-amber-950 font-serif font-bold border-y-2 border-amber-600/60">
              <tr>
                <th className="py-2 px-2 w-8">#</th>
                <th className="py-2 px-2">Contract Item / Description</th>
                <th className="py-2 px-2 text-center w-16">Qty</th>
                <th className="py-2 px-2 text-right w-24">Rate</th>
                <th className="py-2 px-2 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-2 text-amber-800 font-bold">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2 px-2 text-center">{it.quantity}</td>
                  <td className="py-2 px-2 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2 px-2 text-right mono font-bold">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Executive Total */}
        <div className="flex justify-between items-center border-2 border-double border-amber-600/70 p-3 bg-amber-50/50 font-serif font-black text-amber-950 text-sm">
          <span>OFFICIAL CONTRACT TOTAL</span>
          <span className="mono text-xl text-amber-900">₹{subtotal.toFixed(2)}</span>
        </div>

        {/* Signatures & Payment QR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end font-sans">
          {renderOnlinePaymentQrBlock()}
          {renderSignatureSeal('Official Digital Seal')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     6. ELEGANT ROYALTY GOLD EDITION TEMPLATE
     ========================================================================= */
  if (activeTplId === 'royalty-gold') {
    return (
      <div className="space-y-4 text-slate-900 font-serif">
        {/* Luxury Gold Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 text-slate-950 p-5 rounded-t-lg shadow-md flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 font-black text-lg text-slate-950">
              <Crown size={22} className="text-amber-950" />
              <span>{bizName.toUpperCase()}</span>
            </div>
            <p className="text-xs font-bold text-amber-950/80 mt-0.5">ROYALITY GOLD LUXURY INVOICE</p>
          </div>
          <div className="text-right font-sans">
            <div className="mono font-black text-slate-950 text-base">#{invNumber}</div>
            <div className="text-xs font-extrabold text-slate-900">{invDate}</div>
          </div>
        </div>

        {/* Client Box */}
        <div className="bg-amber-50/80 border border-amber-300 p-4 rounded-xl font-sans text-xs flex justify-between items-start">
          <div>
            <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest block mb-1">VALUED CLIENT</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName}</div>
            {custPhone && <div className="text-slate-600">{custPhone}</div>}
            {custAddress && <div className="text-slate-600">{custAddress}</div>}
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-amber-950 font-black text-[10px]">
              GOLD VIP TRANSACTION
            </span>
          </div>
        </div>

        {/* Gold Table */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-100 text-amber-950 font-serif font-bold border-y-2 border-amber-400">
              <tr>
                <th className="py-2 px-2.5 w-8">#</th>
                <th className="py-2 px-2.5">Luxury Product / Service</th>
                <th className="py-2 px-2 text-center w-14">Qty</th>
                <th className="py-2 px-2 text-right w-24">Rate</th>
                <th className="py-2 px-2.5 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-amber-50/40">
                  <td className="py-2 px-2.5 text-amber-800 font-bold">{idx + 1}</td>
                  <td className="py-2 px-2.5 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2 px-2 text-center font-semibold">{it.quantity}</td>
                  <td className="py-2 px-2 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2 px-2.5 text-right mono font-extrabold text-amber-950">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gold Total */}
        <div className="bg-amber-500/15 border-2 border-amber-400 p-4 rounded-xl flex justify-between items-center font-serif text-amber-950 font-black text-base shadow-sm">
          <span>GRAND TOTAL</span>
          <span className="mono text-2xl text-amber-900">₹{subtotal.toFixed(2)}</span>
        </div>

        {/* Signature & Payment QR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end font-sans">
          {renderBankDetails()}
          {renderSignatureSeal('Royalty Gold Signatory')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     7. CYBER TECH NEON MINIMALIST TEMPLATE
     ========================================================================= */
  if (activeTplId === 'cyber-tech') {
    return (
      <div className="space-y-4 font-mono text-slate-900 text-xs">
        {/* Dark Tech Header */}
        <div className="bg-slate-950 text-emerald-400 p-4 sm:p-5 rounded-t-lg border-b border-emerald-500/40 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 font-bold text-base text-emerald-400">
              <Cpu size={18} />
              <span>{bizName.toUpperCase()}</span>
            </div>
            <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">[SYSTEM_ENGINE: CYBER_TECH_2026]</p>
          </div>
          <div className="text-right">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-1 rounded border border-emerald-500/40 font-bold">
              VERIFIED_TRANSACTION
            </span>
          </div>
        </div>

        {/* System Meta Grid */}
        <div className="bg-slate-900 text-slate-300 p-3 rounded-lg border border-slate-800 text-[11px] grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] text-slate-500 uppercase block">CLIENT_ID</span>
            <div className="font-bold text-slate-100">{custName}</div>
            <div className="text-slate-400 text-[10px]">{custPhone}</div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-500 uppercase block">INVOICE_HASH</span>
            <div className="font-bold text-indigo-300">#{invNumber}</div>
            <div className="text-slate-400 text-[10px]">{invDate}</div>
          </div>
        </div>

        {/* Code Style Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs bg-slate-950 text-slate-200">
            <thead className="bg-slate-900 text-indigo-300 font-bold text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5 w-8">#</th>
                <th className="py-2 px-2.5">MODULE / ITEM</th>
                <th className="py-2 px-2 text-center w-14">QTY</th>
                <th className="py-2 px-2 text-right w-24">RATE</th>
                <th className="py-2 px-2.5 text-right w-28">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-[11px]">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60">
                  <td className="py-2 px-2.5 text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-2.5 font-bold text-slate-100">{it.product_name || 'Item'}</td>
                  <td className="py-2 px-2 text-center text-slate-300">{it.quantity}</td>
                  <td className="py-2 px-2 text-right text-slate-300">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2 px-2.5 text-right font-bold text-emerald-400">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Neon Total */}
        <div className="bg-slate-950 border border-emerald-500/50 p-4 rounded-lg flex justify-between items-center text-emerald-400 font-black text-base shadow-sm">
          <span>&gt; TOTAL_AMOUNT</span>
          <span className="text-xl">₹{subtotal.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {renderOnlinePaymentQrBlock()}
          {renderSignatureSeal('Authorized Cyber Seal')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     8. CHIC BOUTIQUE PASTEL TEMPLATE
     ========================================================================= */
  if (activeTplId === 'chic-boutique') {
    return (
      <div className="space-y-4 text-slate-900 text-xs">
        {/* Soft Pastel Rose Header */}
        <div className="bg-gradient-to-r from-rose-100 via-pink-50 to-rose-100 text-rose-950 p-5 rounded-t-2xl border-b border-rose-200 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 font-black text-lg text-rose-900">
              <Sparkles size={20} className="text-rose-600" />
              <span>{bizName}</span>
            </div>
            <p className="text-xs text-rose-700 font-medium mt-0.5">Chic Boutique & Apparel Store</p>
          </div>
          <div className="text-right">
            <span className="bg-rose-200 text-rose-800 text-xs font-black px-3.5 py-1 rounded-full shadow-2xs">
              #{invNumber}
            </span>
          </div>
        </div>

        {/* Client Details */}
        <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-2xl flex justify-between items-start text-xs">
          <div>
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">CUSTOMER</span>
            <div className="font-extrabold text-slate-900 text-sm">{custName}</div>
            {custPhone && <div className="text-slate-600 mt-0.5">{custPhone}</div>}
            {custAddress && <div className="text-slate-600 mt-0.5">{custAddress}</div>}
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">DATE</span>
            <div className="font-bold text-slate-800">{invDate}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-rose-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-rose-100/70 text-rose-900 font-extrabold text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3 w-8">#</th>
                <th className="py-2.5 px-3">Boutique Item</th>
                <th className="py-2.5 px-2 text-center w-14">Qty</th>
                <th className="py-2.5 px-3 text-right w-24">Price</th>
                <th className="py-2.5 px-3 text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-rose-50/40">
                  <td className="py-2.5 px-3 text-rose-400 font-bold">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2.5 px-2 text-center font-semibold">{it.quantity}</td>
                  <td className="py-2.5 px-3 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right mono font-extrabold text-rose-950">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Soft Pink Total Box */}
        <div className="bg-rose-100/80 border border-rose-300 p-4 rounded-2xl flex justify-between items-center font-black text-rose-950 text-base">
          <span>TOTAL AMOUNT</span>
          <span className="mono text-2xl text-rose-900">₹{subtotal.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {renderBankDetails()}
          {renderSignatureSeal('Boutique Manager Signatory')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     9. COMPACT VOUCHER SLIP A5 TEMPLATE
     ========================================================================= */
  if (activeTplId === 'compact-slip') {
    return (
      <div className="space-y-4 text-slate-900 text-xs">
        {/* Crisp Teal Header */}
        <div className="bg-teal-700 text-white p-4 rounded-t-lg flex justify-between items-center">
          <div className="flex items-center gap-2 font-black text-base">
            <Ticket size={18} />
            <span>COUNTER DISPATCH VOUCHER SLIP (A5)</span>
          </div>
          <span className="mono font-bold bg-teal-800 px-3 py-1 rounded text-xs">
            SLIP #{invNumber}
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 bg-teal-50/70 p-3 rounded-lg border border-teal-200 text-xs">
          <div>
            <span className="text-[9px] font-black text-teal-800 uppercase block">STORE / SENDER</span>
            <div className="font-extrabold text-slate-900">{bizName}</div>
            <div className="text-[11px] text-slate-600">{bizPhone}</div>
          </div>
          <div>
            <span className="text-[9px] font-black text-teal-800 uppercase block">RECEIVER / CUSTOMER</span>
            <div className="font-extrabold text-slate-900">{custName}</div>
            <div className="text-[11px] text-slate-600">{custPhone}</div>
          </div>
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto rounded-lg border border-teal-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-teal-800 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="py-2 px-2.5 w-8">#</th>
                <th className="py-2 px-2.5">Item</th>
                <th className="py-2 px-2 text-center w-14">Qty</th>
                <th className="py-2 px-2.5 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100 text-[11px]">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-2.5 text-teal-700 font-bold">{idx + 1}</td>
                  <td className="py-2 px-2.5 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                  <td className="py-2 px-2 text-center">{it.quantity}</td>
                  <td className="py-2 px-2.5 text-right mono font-bold">₹{Number(it.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total Summary */}
        <div className="bg-teal-50 border border-teal-300 p-3 rounded-lg flex justify-between items-center font-extrabold text-teal-950">
          <span>VOUCHER TOTAL</span>
          <span className="mono text-lg font-black text-teal-800">₹{subtotal.toFixed(2)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {renderOnlinePaymentQrBlock()}
          {renderSignatureSeal('Authorized Dispatch Signatory')}
        </div>
      </div>
    );
  }

  /* =========================================================================
     10. STANDARD COMMERCIAL TEMPLATE (DEFAULT FALLBACK)
     ========================================================================= */
  return (
    <div className="space-y-4 text-slate-900 text-xs">
      {/* Top Orange Accent Header Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-t-lg" />

      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-600 text-lg font-black text-white shadow-xs">
            {bizName[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">{bizName}</h1>
            <p className="text-[11px] font-medium text-slate-500">{business?.owner_name || 'Commercial Trading Store'}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
              {bizPhone && <span className="flex items-center gap-1"><Phone size={11} /> {bizPhone}</span>}
              {bizAddress && <span className="flex items-center gap-1"><MapPin size={11} /> {bizAddress}</span>}
              {bizGstin && (
                <span className="flex items-center gap-1 font-bold text-orange-600">
                  <ShieldCheck size={11} /> GSTIN: {bizGstin}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Meta Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left sm:text-right sm:min-w-[170px]">
          <div className="text-[9px] font-black uppercase tracking-wider text-orange-600">TAX INVOICE</div>
          <div className="mono text-base font-black tracking-tight text-slate-900">{invNumber}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{invDate} {timeStr ? `• ${timeStr}` : ''}</div>
          <div className="mt-1 text-[10px] font-extrabold uppercase text-emerald-600">
            {isPaid ? '✓ PAID IN FULL' : 'COMMERCIAL BILL'}
          </div>
        </div>
      </div>

      {/* Customer Billed To */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-orange-600">BILLED TO</span>
          <div className="mt-0.5 text-xs font-bold text-slate-900 truncate">{custName}</div>
          <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
            {custPhone && <div className="flex items-center gap-1"><Phone size={11} /> {custPhone}</div>}
            {custAddress && <div className="flex items-center gap-1"><MapPin size={11} /> {custAddress}</div>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-orange-600">PAYMENT & DISPATCH</span>
            <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
              <div>Status: <strong className={isPaid ? 'text-emerald-600' : 'text-amber-600'}>{isPaid ? 'Paid' : 'Pending'}</strong></div>
              {invoice?.payment_method && <div>Method: {invoice.payment_method}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Item Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-700">
            <tr>
              <th className="py-2 px-2.5 w-8 text-center">#</th>
              <th className="py-2 px-2.5">Item Description</th>
              <th className="py-2 px-2 text-center w-16">Qty</th>
              <th className="py-2 px-2 text-right w-24">Price</th>
              <th className="py-2 px-2.5 text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px]">
            {items.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-slate-50">
                <td className="py-2 px-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                <td className="py-2 px-2.5 font-bold text-slate-900">{it.product_name || 'Item'}</td>
                <td className="py-2 px-2 text-center font-semibold">{it.quantity} {it.product_unit || 'pcs'}</td>
                <td className="py-2 px-2 text-right mono">₹{Number(it.unit_price || 0).toFixed(2)}</td>
                <td className="py-2 px-2.5 text-right mono font-extrabold text-slate-900">₹{Number(it.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculations & Bank */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {renderBankDetails()}

        <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-right">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="mono font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-amber-200 pt-1.5 font-black text-slate-900 text-sm">
            <span>Grand Total:</span>
            <span className="mono text-orange-600 text-base font-black">₹{subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-500">
        <div>Computer generated commercial invoice. Thank you for your business!</div>
        {renderSignatureSeal('Authorized Signatory')}
      </div>
    </div>
  );
}
