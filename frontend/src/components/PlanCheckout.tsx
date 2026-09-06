import { useState, useRef } from 'react';
import { 
  ShieldCheck, Check, ArrowLeft, QrCode, Copy, Upload, ImagePlus, 
  AlertTriangle, Clock, CheckCircle2, Lock, Sparkles, X, CheckCheck,
  Download, Smartphone, ExternalLink, Tag
} from 'lucide-react';
import { toast } from 'sonner';

export type BillingCycle = '1m' | '3m' | '6m' | '1y' | '2y' | '3y';

export interface BillingCycleConfig {
  id: BillingCycle;
  label: string;
  shortLabel: string;
  durationName: string;
  periodText: string;
  badge?: string;
  savingsBadge?: string;
  months: number;
  isDefault?: boolean;
}

export const BILLING_CYCLES: BillingCycleConfig[] = [
  { id: '1m', label: '1 Month (Monthly Plan)', shortLabel: '1 Month', durationName: '1 Month Plan', periodText: 'per month', badge: 'Standard', months: 1 },
  { id: '3m', label: '3 Months (Quarterly Plan)', shortLabel: '3 Months', durationName: '3 Months Plan', periodText: '3 Months', badge: '5% OFF', savingsBadge: '5% OFF', months: 3 },
  { id: '6m', label: '6 Months (Half-Yearly)', shortLabel: '6 Months', durationName: '6 Months Plan', periodText: '6 Months', badge: '17% OFF', savingsBadge: '17% OFF', months: 6 },
  { id: '1y', label: '1 Year (Annual Plan)', shortLabel: '1 Year', durationName: '1 Year Plan', periodText: '1 Year (Annual)', badge: '20% OFF ⭐', savingsBadge: '20% OFF', months: 12, isDefault: true },
  { id: '2y', label: '2 Years (2-Year Plan)', shortLabel: '2 Years', durationName: '2 Years Plan', periodText: '2 Years', badge: '25% OFF', savingsBadge: '25% OFF', months: 24 },
  { id: '3y', label: '3 Years (3-Year Plan)', shortLabel: '3 Years', durationName: '3 Years Plan', periodText: '3 Years', badge: '30% OFF 🔥', savingsBadge: '30% OFF', months: 36 },
];

export function getPriceDetailsForCycle(baseMonthly: number, baseYearly: number, cycle: BillingCycle) {
  if (baseMonthly === 0 && baseYearly === 0) {
    return {
      priceNum: 0,
      priceStr: '₹0',
      periodText: 'Forever free',
      cycleObj: BILLING_CYCLES.find(c => c.id === cycle) || BILLING_CYCLES[3],
    };
  }

  const baseMonthlyPrice = baseMonthly > 0 ? baseMonthly : (baseYearly > 0 ? baseYearly / 10 : 499);
  const baseYearlyPrice = baseYearly > 0 ? baseYearly : baseMonthlyPrice * 10;

  let priceNum = baseMonthlyPrice;
  switch (cycle) {
    case '1m':
      priceNum = baseMonthlyPrice;
      break;
    case '3m':
      priceNum = Math.round(baseMonthlyPrice * 3 * 0.95);
      break;
    case '6m':
      priceNum = Math.round(baseMonthlyPrice * 5); // 1 Month Free
      break;
    case '1y':
      priceNum = baseYearlyPrice; // 2 Months Free
      break;
    case '2y':
      priceNum = Math.round(baseMonthlyPrice * 18); // 6 Months Free
      break;
    case '3y':
      priceNum = Math.round(baseMonthlyPrice * 25); // 11 Months Free
      break;
  }

  const cycleObj = BILLING_CYCLES.find(c => c.id === cycle) || BILLING_CYCLES[3];

  return {
    priceNum,
    priceStr: `₹${priceNum.toLocaleString()}`,
    periodText: cycleObj.periodText,
    cycleObj,
  };
}

interface PlanCheckoutProps {
  planName?: string;
  planPrice?: string;
  initialCycle?: BillingCycle;
  onBack?: () => void;
  business?: any;
}

export function PlanCheckout({ planName = 'Starter Business', planPrice = '₹499', initialCycle = '1y', onBack, business }: PlanCheckoutProps) {
  const [utr, setUtr] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [verifyingCoupon, setVerifyingCoupon] = useState(false);

  const upiId = 'billingmaster@upi';

  // Base price calculation
  const baseMonthlyPriceNum = (() => {
    const raw = (planPrice || '₹499').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed === 0 ? 499 : parsed;
  })();

  const baseYearlyPriceNum = baseMonthlyPriceNum * 10;
  
  const currentDetails = getPriceDetailsForCycle(baseMonthlyPriceNum, baseYearlyPriceNum, billingCycle);
  const currentPriceNum = currentDetails.priceNum;
  const currentPriceStr = currentDetails.priceStr;
  const currentCycleLabel = currentDetails.cycleObj.label;
  const currentDurationName = currentDetails.cycleObj.durationName;

  let finalPriceNum = currentPriceNum;
  let couponDiscountNum = 0;

  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      couponDiscountNum = Math.round((currentPriceNum * Number(appliedCoupon.discount_value)) / 100);
    } else {
      couponDiscountNum = Math.round(Number(appliedCoupon.discount_value));
    }
    if (couponDiscountNum > currentPriceNum) couponDiscountNum = currentPriceNum;
    finalPriceNum = Math.max(0, currentPriceNum - couponDiscountNum);
  }

  const finalPriceStr = `₹${finalPriceNum.toLocaleString()}`;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      toast.error('Please enter a promo coupon code.');
      return;
    }

    setVerifyingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim().toUpperCase(),
          originalPrice: currentPriceNum,
          businessId: business?.id || business?.name || 'guest_merchant',
        }),

      });

      const json = await res.json();
      if (res.ok && json.valid) {
        setAppliedCoupon(json);
        toast.success(json.message || `Coupon ${json.code} applied!`);
      } else {
        toast.error(json.error || 'Invalid or expired promo coupon code.');
      }
    } catch (err) {
      toast.error('Failed to validate coupon code.');
    } finally {
      setVerifyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    toast.info('Coupon code removed.');
  };

  const handleDownloadQr = () => {
    try {
      const svgEl = document.getElementById('upi-qr-svg') as SVGElement | null;
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 0, 0, 400, 400);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `billingmaster_upi_qr_${planName.replace(/\s+/g, '_').toLowerCase()}_${billingCycle}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          toast.success('QR Code downloaded successfully!');
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      toast.error('Failed to download QR Code.');
    }
  };

  const handleOpenPaymentApp = () => {
    const upiUri = `upi://pay?pa=${upiId}&pn=BillingMaster&am=${finalPriceNum}&cu=INR&tn=${encodeURIComponent(planName + ' ' + currentCycleLabel + ' Upgrade')}`;
    window.location.href = upiUri;
    toast.info('Launching UPI payment apps...');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (PNG or JPG).');
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success('Payment screenshot uploaded.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile && !screenshotPreview) {
      toast.error('Please upload your payment screenshot before submitting.');
      return;
    }

    setSubmitting(true);
    const fullPlanName = appliedCoupon
      ? `${planName} (${currentDurationName}) [Coupon: ${appliedCoupon.code}]`
      : `${planName} (${currentDurationName})`;
    const fullPriceStr = appliedCoupon
      ? `${finalPriceStr} / ${currentDetails.cycleObj.shortLabel} (Saved ₹${couponDiscountNum.toLocaleString()} via ${appliedCoupon.code})`
      : `${currentPriceStr} / ${currentDetails.cycleObj.shortLabel}`;

    const newRecord = {
      id: `BILL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      planName: fullPlanName,
      planPrice: fullPriceStr,
      utr: utr || `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      notes: utr ? `Submitted UTR: ${utr}. Duration: ${currentCycleLabel}.` : `Payment screenshot uploaded for ${currentCycleLabel}.`,
      screenshotUrl: screenshotPreview || '',
      status: 'pending_verification',
      timestamp: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }) + ' at ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      paymentMethod: 'Direct UPI App',
    };

    try {
      const existing = JSON.parse(localStorage.getItem('billingmaster_payment_history') || '[]');
      localStorage.setItem('billingmaster_payment_history', JSON.stringify([newRecord, ...existing]));
    } catch (e) {}

    try {
      await fetch('/api/billing-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business?.id || 'biz-01',
          business_name: business?.name || 'Merchant Store',
          requested_plan: fullPlanName,
          price: fullPriceStr,
          utr_ref: utr || newRecord.utr,
          screenshot_url: screenshotPreview || '',
          coupon_code: appliedCoupon?.code || '',
        }),
      });
    } catch (err) {}


    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success('Payment verification submitted!');
    }, 500);
  };


  if (submitted) {
    return (
      <div className="mx-auto max-w-xl p-4 sm:p-6 lg:p-8 animate-fade-in">
        <div className="card-shell p-6 sm:p-8 space-y-6 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-black text-foreground">
              Payment Verification Received
            </h1>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Your payment proof for <strong className="text-foreground">{planName} ({currentCycleLabel})</strong> has been submitted and queued for verification.
            </p>
          </div>

          {/* Guaranteed Activation Time Banner */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left flex items-start gap-3">
            <Clock size={20} className="text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                Activation Time Guarantee
              </div>
              <div className="text-xs font-bold text-foreground">
                Your plan will be activated within <span className="text-primary font-extrabold">maximum 6 hours</span> (typically processed within <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">1 hour</span>).
              </div>
            </div>
          </div>

          {/* Submission Details */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs space-y-2 text-left">
            <div className="flex justify-between border-b border-border/50 pb-1.5 font-medium">
              <span className="text-muted-foreground">Store:</span>
              <span className="font-extrabold text-foreground">{business?.name || 'Merchant Store'}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5 font-medium">
              <span className="text-muted-foreground">Requested Plan:</span>
              <span className="font-extrabold text-primary">{planName} ({currentPriceStr} / {currentDetails.cycleObj.shortLabel})</span>
            </div>
            {utr && (
              <div className="flex justify-between border-b border-border/50 pb-1.5 font-medium">
                <span className="text-muted-foreground">UTR / Transaction ID:</span>
                <span className="font-mono font-extrabold text-foreground">{utr}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                ● Pending Verification
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => window.location.href = '/more'}
              className="btn-primary w-full py-3 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              View Billing & History
            </button>
            <button
              onClick={onBack ? onBack : () => window.location.href = '/plan'}
              className="btn-outline w-full py-3 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              Return to Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Sleek Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack ? onBack : () => window.history.back()}
          className="btn-outline flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Plans</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          <ShieldCheck size={14} />
          <span>100% Risk-Free Direct Transfer</span>
        </div>
      </div>

      {/* Sleek Duration Cycle Selector (6 Options, Default: 1 Year) */}
      <div className="card-shell p-4 sm:p-5 space-y-3 shadow-md border border-orange-500/30 bg-card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-orange-500 shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-foreground">
              Select Subscription Duration for {planName}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 uppercase tracking-wider">
            {currentDetails.cycleObj.durationName} Selected
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {BILLING_CYCLES.map((cycleItem) => {
            const isSelected = billingCycle === cycleItem.id;
            const calc = getPriceDetailsForCycle(baseMonthlyPriceNum, baseYearlyPriceNum, cycleItem.id);
            return (
              <button
                key={cycleItem.id}
                type="button"
                onClick={() => setBillingCycle(cycleItem.id)}
                className={`p-3 rounded-2xl border transition-all relative flex flex-col items-center justify-between text-center cursor-pointer min-h-[96px] ${
                  isSelected
                    ? 'bg-orange-500 border-orange-500 text-white shadow-md ring-2 ring-orange-500/40 scale-[1.02]'
                    : 'bg-card border-border hover:border-orange-400 hover:bg-orange-500/5 text-foreground'
                }`}
              >
                {/* Fixed height top slot for 100% horizontal alignment */}
                <div className="h-5 flex items-center justify-center w-full mb-1">
                  {cycleItem.badge ? (
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block truncate max-w-full ${
                        isSelected
                          ? 'bg-white text-orange-600 shadow-xs'
                          : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                      }`}
                    >
                      {cycleItem.badge}
                    </span>
                  ) : (
                    <span className="opacity-0 text-[9px]">-</span>
                  )}
                </div>

                {/* Title & Checkmark */}
                <div className="flex items-center justify-center gap-1 w-full">
                  <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-foreground'}`}>
                    {cycleItem.shortLabel}
                  </span>
                  {isSelected && (
                    <Check size={13} strokeWidth={3} className="text-white shrink-0" />
                  )}
                </div>

                {/* Price */}
                <div className="mt-1">
                  <span className={`text-xs font-black block tracking-tight ${isSelected ? 'text-white' : 'text-orange-600 dark:text-orange-400'}`}>
                    {calc.priceStr}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Unified Container */}
      <div className="card-shell overflow-hidden p-0 shadow-lg border border-border">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 px-6 py-4 text-white flex items-center justify-between border-b border-neutral-800">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-orange-500">
              Direct UPI Checkout
            </div>
            <h1 className="text-lg font-black">{planName} Upgrade</h1>
          </div>
          <div className="text-right">
            {appliedCoupon ? (
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-sm line-through text-neutral-400 font-mono font-semibold">{currentPriceStr}</span>
                <span className="text-2xl font-black text-orange-400 font-mono">{finalPriceStr}</span>
              </div>
            ) : (
              <span className="text-2xl font-black text-orange-500 font-mono">{currentPriceStr}</span>
            )}
            <span className="text-[11px] text-neutral-400 block font-medium">
              Billed for {currentDetails.cycleObj.shortLabel} ({currentDetails.cycleObj.durationName})
            </span>
          </div>
        </div>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left Column: QR Code & Payment App Action */}
          <div className="md:col-span-5 p-6 space-y-4 flex flex-col justify-between bg-muted/20">
            <div className="space-y-3.5">
              <div className="text-center space-y-0.5">
                <div className="text-xs font-extrabold text-foreground flex items-center justify-center gap-1.5">
                  <QrCode size={15} className="text-orange-500" />
                  <span>Scan to Pay {finalPriceStr}</span>
                  {appliedCoupon && (
                    <span className="line-through text-muted-foreground text-[10px] font-medium">{currentPriceStr}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Use GPay, PhonePe, Paytm, or BHIM</p>
              </div>

              {/* Clean QR Box */}
              <div className="mx-auto max-w-[190px] rounded-2xl border-2 border-orange-500/20 bg-white p-3 shadow-sm text-center">
                <svg id="upi-qr-svg" className="w-full h-auto aspect-square" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" fill="white"/>
                  {/* Outer corner blocks */}
                  <rect x="6" y="6" width="26" height="26" fill="#18181B"/>
                  <rect x="10" y="10" width="18" height="18" fill="white"/>
                  <rect x="14" y="14" width="10" height="10" fill="#F97316"/>

                  <rect x="68" y="6" width="26" height="26" fill="#18181B"/>
                  <rect x="72" y="10" width="18" height="18" fill="white"/>
                  <rect x="76" y="14" width="10" height="10" fill="#F97316"/>

                  <rect x="6" y="68" width="26" height="26" fill="#18181B"/>
                  <rect x="10" y="72" width="18" height="18" fill="white"/>
                  <rect x="14" y="76" width="10" height="10" fill="#F97316"/>

                  {/* QR Matrix Elements */}
                  <rect x="38" y="10" width="8" height="8" fill="#18181B"/>
                  <rect x="50" y="10" width="12" height="6" fill="#18181B"/>
                  <rect x="38" y="24" width="24" height="6" fill="#18181B"/>

                  <rect x="10" y="38" width="6" height="24" fill="#18181B"/>
                  <rect x="22" y="38" width="12" height="8" fill="#18181B"/>
                  <rect x="22" y="50" width="8" height="12" fill="#18181B"/>

                  <rect x="38" y="38" width="24" height="24" fill="#F97316"/>
                  <rect x="44" y="44" width="12" height="12" fill="white"/>
                  <rect x="48" y="48" width="4" height="4" fill="#18181B"/>

                  <rect x="68" y="38" width="8" height="16" fill="#18181B"/>
                  <rect x="80" y="38" width="14" height="8" fill="#18181B"/>
                  <rect x="80" y="50" width="14" height="12" fill="#18181B"/>

                  <rect x="38" y="68" width="12" height="8" fill="#18181B"/>
                  <rect x="54" y="68" width="8" height="26" fill="#18181B"/>
                  <rect x="38" y="80" width="12" height="14" fill="#18181B"/>
                  <rect x="68" y="80" width="26" height="14" fill="#18181B"/>
                </svg>
                <div className="mt-1 text-[10px] font-extrabold text-neutral-800 tracking-wider">
                  ALL UPI APPS ACCEPTED
                </div>
              </div>

              {/* Download QR Code Button */}
              <button
                type="button"
                onClick={handleDownloadQr}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>Download QR Code</span>
              </button>

              {/* Continue to Payment App Button */}
              <button
                type="button"
                onClick={handleOpenPaymentApp}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all cursor-pointer"
              >
                <Smartphone size={15} />
                <span>Continue to Payment App</span>
              </button>
            </div>

            {/* Micro Guarantee Note */}
            <div className="pt-2 text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 font-medium">
              <Lock size={12} className="text-emerald-500" />
              <span>Static direct transfer • 100% Verified & Safe</span>
            </div>
          </div>

          {/* Right Column: Upload Proof & Submit Form */}
          <div className="md:col-span-7 p-6 space-y-5 flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Upload size={16} className="text-orange-500" />
                  Upload Payment Screenshot & Details
                </h2>
                <p className="text-xs text-muted-foreground">
                  Upload your transaction receipt image to verify your payment.
                </p>
              </div>

              {/* Compact Drag & Drop File Upload */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
              />

              {screenshotPreview ? (
                <div className="relative rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3 text-center">
                  <img 
                    src={screenshotPreview} 
                    alt="Payment Screenshot" 
                    className="max-h-36 mx-auto rounded-lg object-contain border border-border shadow-xs" 
                  />
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                    >
                      Change Image
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotFile(null);
                        setScreenshotPreview(null);
                      }}
                      className="text-destructive hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-5 text-center hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-1.5">
                    <ImagePlus size={20} />
                  </div>
                  <div className="text-xs font-bold text-foreground">Click to upload payment receipt image</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG (Max 5MB)</div>
                </div>
              )}

              {/* Promo Coupon Code Box */}
              <div className="rounded-2xl border border-border bg-card p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Tag size={15} className="text-orange-500" />
                    Have a Promo Coupon Code?
                  </label>
                  {appliedCoupon && (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      ✓ {appliedCoupon.code} Applied (-₹{couponDiscountNum.toLocaleString()})
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-extrabold">
                      <Sparkles size={14} />
                      <span>Promo Code {appliedCoupon.code}: Saved ₹{couponDiscountNum.toLocaleString()}!</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-destructive hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code (e.g. WELCOME50)"
                      className="input-shell flex-1 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={verifyingCoupon}
                      className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {verifyingCoupon ? 'Applying...' : 'Apply Coupon'}
                    </button>
                  </div>
                )}
              </div>

              {/* Fee & GST Summary Breakdown */}
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="font-extrabold text-foreground border-b border-border/60 pb-2 flex items-center justify-between">
                  <span>Order Price & Fee Breakdown</span>
                  <span className="text-[11px] font-bold text-muted-foreground">{currentCycleLabel}</span>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base Plan Fee ({planName})</span>
                    <span className="font-mono font-semibold text-foreground">{currentPriceStr}</span>
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Promo Discount ({appliedCoupon.code})</span>
                      <span className="font-mono">- ₹{couponDiscountNum.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-muted-foreground">
                    <span>GST & Applicable Taxes (18%)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">Included (₹0 Extra)</span>
                  </div>

                  <div className="flex justify-between border-t border-border/80 pt-2 font-black text-xs text-foreground">
                    <span>Total Amount Payable</span>
                    <div className="text-right flex items-center gap-2">
                      {appliedCoupon && (
                        <span className="text-xs line-through text-muted-foreground font-mono font-medium">{currentPriceStr}</span>
                      )}
                      <span className="text-sm text-orange-500 font-mono font-black">{finalPriceStr}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optional UTR Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-foreground">
                  UTR / Transaction ID <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. UTR 423981290381"
                  className="input-shell w-full px-3 py-2 text-xs font-normal focus:border-orange-500"
                />
              </div>

              {/* Submit Action & Anti-Spam Warning */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting Verification...' : 'Submit Payment Proof'}
                </button>

                <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-semibold leading-tight flex items-center justify-center gap-1">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>Do not submit duplicate or fake receipts. False submissions will cause account suspension.</span>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
