import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Check, Sparkles, Zap, Building2, Crown, 
  HelpCircle, ArrowRight, MessageCircle, ExternalLink, RefreshCw, History as HistoryIcon,
  Clock, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { PlanCheckout, BillingCycle, BILLING_CYCLES, getPriceDetailsForCycle } from '@/components/PlanCheckout';
import { db, auth, getImpersonatedBusinessId } from '@/lib/api';

interface PlanPageProps {
  business?: any;
}

export function PlanPage({ business: initialBusiness }: PlanPageProps) {
  const [business, setBusiness] = useState<any>(initialBusiness || null);
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] = useState<{ name: string; price: string; initialCycle?: BillingCycle; rawPlan?: any } | null>(null);
  const [pageCycle, setPageCycle] = useState<BillingCycle>('1y');

  useEffect(() => {
    if (initialBusiness) {
      setBusiness(initialBusiness);
      return;
    }
    async function loadBiz() {
      try {
        const impersonatedBid = getImpersonatedBusinessId();
        const session = auth.session() || (await auth.getSession());
        let bid = impersonatedBid;
        if (!bid && session?.user?.id) {
          const profiles = await db.list<any>('profiles', { id: session.user.id });
          if (profiles && profiles[0]?.business_id) bid = profiles[0].business_id;
        }
        if (bid) {
          const bizes = await db.list<any>('businesses', { id: bid });
          if (bizes && bizes.length > 0) setBusiness(bizes[0]);
        }
      } catch (e) {}
    }
    void loadBiz();
  }, [initialBusiness]);

  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      setPlansLoading(true);
      try {
        const res = await fetch('/api/admin/plans');
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            setDbPlans(json.data);
          }
        }
      } catch (e) {
      } finally {
        setPlansLoading(false);
      }
    }
    void loadPlans();
  }, []);

  const rawPlanName = business?.plan_name || 'Free';

  const [allBillingRequests, setAllBillingRequests] = useState<any[]>([]);
  const [subscriptionQueue, setSubscriptionQueue] = useState<any[]>([]);

  useEffect(() => {
    if (business?.id) {
      fetch(`/api/billing-requests/my?business_id=${business.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setAllBillingRequests(json.data);
          }
        })
        .catch(() => {});

      fetch(`/api/subscription-queue/my?business_id=${business.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setSubscriptionQueue(json.data);
          }
        })
        .catch(() => {});
    }
  }, [business?.id]);

  const getExpiryDetails = () => {
    // 1. Check if there is an active item in subscriptionQueue
    const activeSub = subscriptionQueue.find((i: any) => i.status === 'active');

    if (activeSub) {
      const activePlanNameStr = (activeSub.plan_name || '').toLowerCase().trim();
      const isFreeTier = !activePlanNameStr || activePlanNameStr === 'free' || activePlanNameStr === 'free tier';

      if (isFreeTier) {
        return {
          isFree: true,
          daysLeft: null,
          totalDurationDays: null,
          expiryDateStr: 'Lifetime Access',
          statusText: 'Forever Free Plan',
          percentLeft: 100,
          activePlanName: activeSub.plan_name || 'Free Tier',
        };
      }

      const expiresAt = activeSub.expires_at ? new Date(activeSub.expires_at) : new Date();
      const now = new Date();
      const diffTime = expiresAt.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const totalDurationDays = Math.max(1, Number(activeSub.duration_days) || 365);
      const percentLeft = Math.min(100, Math.max(0, Math.round((daysLeft / totalDurationDays) * 100)));

      const expiryDateStr = expiresAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return {
        isFree: false,
        daysLeft,
        totalDurationDays,
        expiryDateStr,
        rawExpiryDate: expiresAt,
        statusText: daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired',
        percentLeft,
        activePlanName: activeSub.plan_name,
      };
    }

    // 2. Fallback if no active sub row in queue yet
    const planNameLower = (rawPlanName || '').toLowerCase().trim();
    const matchingDbPlan = dbPlans.find(
      (p) => (p.name || '').toLowerCase().trim() === planNameLower || (p.code || '').toLowerCase().trim() === planNameLower
    );
    const isZeroPrice = matchingDbPlan
      ? Number(matchingDbPlan.price_monthly) === 0 && Number(matchingDbPlan.price_yearly) === 0
      : false;

    const isFree = !planNameLower || planNameLower === 'free' || planNameLower === 'free tier' || isZeroPrice;
    
    if (isFree) {
      return {
        isFree: true,
        daysLeft: null,
        totalDurationDays: null,
        expiryDateStr: 'Lifetime Access',
        statusText: 'Forever Free Plan',
        percentLeft: 100,
        activePlanName: rawPlanName || 'Free Tier',
      };
    }

    const getDurationDaysFromPlanName = (planStr: string): number => {
      if (!planStr) return 365;
      const str = planStr.toLowerCase();
      if (str.includes('3 year') || str.includes('3-year') || str.includes('3 yr') || str.includes('3y')) return 1095;
      if (str.includes('2 year') || str.includes('2-year') || str.includes('2 yr') || str.includes('2y')) return 730;
      if (str.includes('1 year') || str.includes('1-year') || str.includes('1 yr') || str.includes('1y') || str.includes('yearly') || str.includes('annual')) return 365;
      if (str.includes('6 month') || str.includes('6-month') || str.includes('6 mo') || str.includes('6m') || str.includes('half-year') || str.includes('half yearly')) return 180;
      if (str.includes('3 month') || str.includes('3-month') || str.includes('3 mo') || str.includes('3m') || str.includes('quarterly')) return 90;
      if (str.includes('1 month') || str.includes('1-month') || str.includes('1 mo') || str.includes('1m') || str.includes('monthly')) return 30;
      return 365;
    };

    const acceptedRequests = allBillingRequests
      .filter((r: any) => r.status === 'accepted')
      .sort((a: any, b: any) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime());

    if (acceptedRequests.length === 0) {
      const startDateStr = business?.updated_at || business?.created_at || new Date().toISOString();
      const startDate = new Date(startDateStr);
      const durationDays = getDurationDaysFromPlanName(rawPlanName);
      const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const percentLeft = Math.min(100, Math.max(0, Math.round((daysLeft / durationDays) * 100)));

      return {
        isFree: false,
        daysLeft,
        totalDurationDays: durationDays,
        expiryDateStr: expiryDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        rawExpiryDate: expiryDate,
        statusText: daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired',
        percentLeft,
        activePlanName: rawPlanName,
      };
    }

    // Use latest accepted request expiry date for fallback
    const latestReq = acceptedRequests[acceptedRequests.length - 1];
    const reqDate = new Date(latestReq.updated_at || latestReq.created_at);
    const durationDays = getDurationDaysFromPlanName(latestReq.requested_plan || rawPlanName);
    const finalExpiryDate = new Date(reqDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diffTime = finalExpiryDate.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const percentLeft = Math.min(100, Math.max(0, Math.round((daysLeft / Math.max(1, durationDays)) * 100)));

    const expiryDateStr = finalExpiryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return {
      isFree: false,
      daysLeft,
      totalDurationDays: durationDays,
      expiryDateStr,
      rawExpiryDate: finalExpiryDate,
      statusText: daysLeft > 0 ? `${daysLeft} Days Remaining` : 'Expired',
      percentLeft,
      activePlanName: latestReq.requested_plan || rawPlanName,
    };
  };

  const expiry = getExpiryDetails();
  const currentPlanName = expiry.activePlanName || rawPlanName;

  const handleRequestUpgrade = (planObj: any, fallbackPrice = '₹499') => {
    if (typeof planObj === 'string') {
      setSelectedCheckoutPlan({ name: planObj, price: fallbackPrice, initialCycle: pageCycle });
    } else {
      setSelectedCheckoutPlan({
        name: planObj.name,
        price: planObj.price,
        initialCycle: pageCycle,
        rawPlan: planObj.rawPlan || planObj,
      });
    }
  };

  const formatLimit = (val: number | undefined, unit: string) => {
    if (val === undefined || val === null || val === -1 || val >= 999999) return `Unlimited ${unit}`;
    if (val === 0) return `0 ${unit}`;
    return `${val.toLocaleString()} ${unit}`;
  };

  const plans = dbPlans.map((p) => {
    let featuresList: string[] = [];
    if (p.display_features) {
      if (typeof p.display_features === 'string') {
        featuresList = p.display_features.split('\n').map((f: string) => f.trim()).filter(Boolean);
      } else if (Array.isArray(p.display_features)) {
        featuresList = p.display_features.filter(Boolean);
      }
    }
    if (featuresList.length === 0) {
      featuresList.push(
        formatLimit(p.max_invoices_per_month, 'Invoices / Month'),
        formatLimit(p.max_users, 'Employees Allowed'),
        formatLimit(p.max_customers, 'Max Customers Cap'),
        formatLimit(p.max_products, 'Max Products Cap'),
        `KhataBook Credit Ledger: ${p.allow_khatabook ? 'Enabled' : 'Disabled'}`,
        `AI Assistant & Barcodes: ${p.allow_ai_assistant ? 'Enabled' : 'Disabled'}`,
        `Custom Invoice Branding: ${p.allow_custom_branding ? 'Enabled' : 'Disabled'}`
      );
    }

    const isFree = Number(p.price_monthly) === 0;
    const monthlyNum = Number(p.price_monthly) || 0;
    const yearlyNum = Number(p.price_yearly) || monthlyNum * 10;
    const calc = getPriceDetailsForCycle(monthlyNum, yearlyNum, pageCycle, {
      p3m: p.price_3months,
      p6m: p.price_6months,
      p2y: p.price_2years,
      p3y: p.price_3years,
    });

    return {
      id: p.id,
      rawPlan: p,
      name: p.name,
      code: p.code || p.name,
      price: isFree ? '₹0' : calc.priceStr,
      period: isFree ? 'Forever free' : calc.periodText,
      description: isFree ? 'Essential billing tools for micro-merchants and startups.' : `Full feature access with ${p.max_invoices_per_month === -1 ? 'Unlimited' : p.max_invoices_per_month} invoices.`,
      features: featuresList,
      badge_tag: p.badge_tag || '',
      popular: p.badge_tag ? p.badge_tag.toLowerCase().includes('popular') : p.code === 'PRO',
    };
  });

  if (selectedCheckoutPlan) {
    return (
      <PlanCheckout 
        planName={selectedCheckoutPlan.name} 
        planPrice={selectedCheckoutPlan.price} 
        initialCycle={selectedCheckoutPlan.initialCycle || pageCycle}
        onBack={() => setSelectedCheckoutPlan(null)} 
        business={business} 
        plan={selectedCheckoutPlan.rawPlan}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-7 lg:p-10 animate-fade-in">
      {/* Clean Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Subscription Plans
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active Store Plan: <strong className="text-primary capitalize">{currentPlanName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.location.href = '/more#billing-history'}
            className="btn-outline flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <HistoryIcon size={14} />
            <span>Billing History</span>
          </button>
          {!expiry.isFree ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 px-3.5 py-1 text-xs font-black text-orange-600 dark:text-orange-400 font-mono shadow-sm">
              <Clock size={13} className="text-orange-500 animate-pulse" />
              <span>{expiry.daysLeft} Days Remaining</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active: {currentPlanName} Plan
            </span>
          )}
        </div>
      </div>

      {/* Active Subscription Telemetry Card */}
      {!expiry.isFree && (
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-orange-500/30 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center font-bold shrink-0 border border-orange-500/20">
                <Clock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-foreground">
                    {currentPlanName} Subscription Active
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Expires on <strong className="text-foreground font-mono">{expiry.expiryDateStr}</strong> ({expiry.totalDurationDays} Days Total Plan Duration)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-left sm:text-right">
                <span className="text-xl font-black text-orange-500 font-mono block leading-none">
                  {expiry.daysLeft} Days
                </span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  Time Remaining
                </span>
              </div>
            </div>
          </div>

          {/* Visual Duration Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>Plan Duration Remaining</span>
              <span className="font-bold text-orange-500">{expiry.daysLeft} of {expiry.totalDurationDays} Days Left</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500 rounded-full" 
                style={{ width: `${expiry.percentLeft}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subscription Queue (`qu`) Card - Rendered ONLY when there are queued plans */}
      {subscriptionQueue.filter((i) => i.status === 'queued').length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center font-black text-xs shrink-0 border border-orange-500/20">
                qu
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <span>Subscription Queue (`qu`)</span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-black font-mono">
                    {subscriptionQueue.filter((i) => i.status === 'queued').length} Queued
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Higher priority plans stand first in queue line (`qu`) and auto-activate after your current active plan expires.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border/60 rounded-xl bg-muted/30 border border-border/60 overflow-hidden">
            {(() => {
              const queuedItems = subscriptionQueue.filter((i) => i.status === 'queued');
              let cumulativeDate = expiry.rawExpiryDate ? new Date(expiry.rawExpiryDate) : new Date();
              let cumulativeDaysFuture = expiry.daysLeft || 0;

              return queuedItems.map((item: any, index: number) => {
                const itemPlanLower = (item.plan_name || '').toLowerCase().trim();
                const matchPlan = dbPlans.find(
                  (p) => (p.name || '').toLowerCase().trim() === itemPlanLower || (p.code || '').toLowerCase().trim() === itemPlanLower
                );
                const isPlanZeroPrices = matchPlan
                  ? Number(matchPlan.priority_order ?? 0) === 0 &&
                    (Number(matchPlan.price_monthly) || 0) === 0 &&
                    (Number(matchPlan.price_3months) || 0) === 0 &&
                    (Number(matchPlan.price_6months) || 0) === 0 &&
                    (Number(matchPlan.price_yearly) || 0) === 0 &&
                    (Number(matchPlan.price_2years) || 0) === 0 &&
                    (Number(matchPlan.price_3years) || 0) === 0
                  : false;

                const isItemFree =
                  !itemPlanLower ||
                  itemPlanLower === 'free' ||
                  itemPlanLower === 'free tier' ||
                  isPlanZeroPrices;

                const itemDuration = isItemFree ? 36500 : Number(item.duration_days) || 365;
                const itemStartDate = new Date(cumulativeDate);
                const itemStartDaysFuture = cumulativeDaysFuture;
                const itemEndDate = new Date(itemStartDate.getTime() + itemDuration * 24 * 60 * 60 * 1000);

                // Accumulate timeline for next queued plan in line
                if (!isItemFree) {
                  cumulativeDate = itemEndDate;
                  cumulativeDaysFuture += itemDuration;
                }

                const startDateStr = itemStartDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const endDateStr = isItemFree
                  ? 'Lifetime Access'
                  : itemEndDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                return (
                  <div key={item.id} className="p-3.5 sm:p-4 space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono font-black text-[11px] border border-orange-500/20">
                          Queue #{index + 1}
                        </span>
                        <div>
                          <span className="font-extrabold text-foreground text-sm">{item.plan_name}</span>
                          <span className="text-muted-foreground text-xs font-mono font-semibold ml-2">
                            {isItemFree ? '(Lifetime Access Plan)' : `(${itemDuration} Days Plan)`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] uppercase tracking-wider border border-amber-500/20">
                          {index === 0 ? 'Next in Line to Activate' : 'Queued in Line'}
                        </span>
                      </div>
                    </div>

                    {/* Start Date & Timeline Telemetry Banner */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black border border-orange-500/20">
                        <Clock size={13} className="animate-pulse text-orange-500" />
                        <span>Starts in {itemStartDaysFuture} Days</span>
                      </span>

                      <span className="px-2 py-1 rounded-lg bg-muted text-foreground font-bold border border-border/60">
                        Starts on {startDateStr} {index === 0 ? `(Right after active plan ends)` : `(After Queue #${index} ends)`}
                      </span>

                      <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                        {isItemFree ? 'Runs: Lifetime Access (Forever Free)' : `Runs: ${startDateStr} → ${endDateStr} (${itemDuration} Days)`}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Duration Cycle Switcher Bar (6 Options, Default: 1 Year) */}
      <div className="flex items-center justify-center pt-1 pb-2">
        <div className="overflow-x-auto max-w-full no-scrollbar flex items-center gap-1.5 p-1.5 rounded-2xl bg-card border border-border shadow-sm">
          {BILLING_CYCLES.map((cycleItem) => {
            const isSelected = pageCycle === cycleItem.id;
            const nonFreePlan = dbPlans.find((p) => Number(p.price_monthly) > 0);
            let dynamicSavings = cycleItem.savingsBadge;
            if (nonFreePlan) {
              const m = Number(nonFreePlan.price_monthly) || 0;
              const y = Number(nonFreePlan.price_yearly) || m * 10;
              const calc = getPriceDetailsForCycle(m, y, cycleItem.id, {
                p3m: nonFreePlan.price_3months,
                p6m: nonFreePlan.price_6months,
                p2y: nonFreePlan.price_2years,
                p3y: nonFreePlan.price_3years,
              });
              if (calc.savingsBadge) dynamicSavings = calc.savingsBadge;
            }

            return (
              <button
                key={cycleItem.id}
                onClick={() => setPageCycle(cycleItem.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-orange-500/5'
                }`}
              >
                <Check size={13} className={isSelected ? 'opacity-100 text-white' : 'opacity-0'} />
                <span>{cycleItem.shortLabel}</span>
                {dynamicSavings && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                  }`}>
                    {dynamicSavings}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prominent Available Plans Grid (Displayed Top & Front) */}
      <div className="space-y-4">
        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-3xl border border-border bg-card/50 p-6 space-y-4">
                <div className="h-6 w-1/2 bg-muted rounded-md" />
                <div className="h-4 w-3/4 bg-muted rounded-md" />
                <div className="h-10 w-1/3 bg-muted rounded-md" />
                <div className="space-y-2 pt-4">
                  <div className="h-4 w-full bg-muted rounded-md" />
                  <div className="h-4 w-5/6 bg-muted rounded-md" />
                  <div className="h-4 w-4/6 bg-muted rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const isCurrent = currentPlanName.toLowerCase().includes(plan.code.toLowerCase()) || 
                               (plan.code === 'Free' && currentPlanName.toLowerCase() === 'free');
              const isFreePlanCard = plan.price === '₹0' || 
                                    (plan.rawPlan && Number(plan.rawPlan.price_monthly) === 0 && Number(plan.rawPlan.price_yearly) === 0 && Number(plan.rawPlan.priority_order ?? 0) === 0);

              return (
                <div 
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all shadow-sm ${
                    isCurrent 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md' 
                      : plan.popular 
                        ? 'border-primary/50 bg-card hover:border-primary' 
                        : 'border-border bg-card hover:border-border/80'
                  }`}
                >
                  {(Boolean(plan.badge_tag) || (plan.popular && !isCurrent)) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-black text-primary-foreground uppercase tracking-widest shadow-md flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>{plan.badge_tag || 'Most Popular'}</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3.5 py-0.5 text-[10px] font-black text-white uppercase tracking-widest shadow-md flex items-center gap-1">
                      <Check size={12} strokeWidth={3} /> Current Active Plan
                    </div>
                  )}

                  <div className="space-y-3.5 pt-1">
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground min-h-[32px]">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1 border-b border-border/50 pb-3">
                      <span className="text-3xl font-black tracking-tight text-foreground">{plan.price}</span>
                      <span className="text-xs font-bold text-muted-foreground">/ {plan.period}</span>
                    </div>

                    <ul className="space-y-2 py-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-xs text-foreground font-medium">
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check size={10} strokeWidth={3} />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-5">
                    {isCurrent ? (
                      <button 
                        disabled 
                        className="w-full rounded-2xl bg-muted py-2.5 text-xs font-extrabold text-muted-foreground cursor-not-allowed opacity-80"
                      >
                        Active Plan
                      </button>
                    ) : isFreePlanCard ? (
                      <button
                        disabled
                        className="w-full rounded-2xl bg-muted py-2.5 text-xs font-extrabold text-muted-foreground cursor-not-allowed opacity-70 border border-border/50"
                      >
                        Default Free Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestUpgrade(plan)}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-extrabold transition-all cursor-pointer shadow-sm btn-primary"
                      >
                        <span>Request Upgrade</span>
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-3xl border border-border bg-card space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto font-black">
              <Sparkles size={24} />
            </div>
            <h3 className="text-base font-extrabold text-foreground">No Subscription Plans Available</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              There are currently no subscription plans configured by Super Admin. Please contact support or check back later.
            </p>
          </div>
        )}
      </div>



      {/* Support & Admin Sync Footer */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <MessageCircle size={18} />
          </div>
          <div>
            <div className="text-xs font-extrabold text-foreground">Need Custom Enterprise Plan?</div>
            <div className="text-[11px] text-muted-foreground">Talk with our Super Admin team to configure custom limits, multi-store access, or dedicated billing setup.</div>
          </div>
        </div>
        <button
          onClick={() => handleRequestUpgrade('Custom Enterprise Tier')}
          className="btn-primary rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <ExternalLink size={13} />
          <span>Contact Super Admin</span>
        </button>
      </div>
    </div>
  );
}
