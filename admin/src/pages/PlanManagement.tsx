import React, { useState, useEffect } from 'react';
import { Plus, Check, Zap, Layers, Sparkles, X, ShieldAlert, Clock, CheckCircle2, XCircle, MessageSquare, AlertCircle, RefreshCw, FileText, Upload, Lock, Tag, Trash2, Edit3, Percent } from 'lucide-react';
import { toast } from 'sonner';

const valToRawString = (val: number | string | undefined, defaultVal: string): string => {
  if (val === undefined || val === null) return defaultVal;
  const num = typeof val === 'number' ? val : Number(val);
  if (val === -1 || (!isNaN(num) && num >= 999999) || String(val).toLowerCase() === 'unlimited' || String(val).toUpperCase() === 'U') {
    return 'U';
  }
  return String(val);
};

const rawStringToVal = (str: string, fallback: number): number => {
  const trimmed = str.trim().toLowerCase();
  if (trimmed === 'u' || trimmed === 'unlimited' || trimmed === '-1') {
    return -1;
  }
  if (trimmed === '') return fallback;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const formatLimitForCard = (val: number | undefined, unitName: string): string => {
  if (val === undefined || val === null || val === -1 || val >= 999999) {
    return `U ${unitName} (Unlimited)`;
  }
  if (val === 0) {
    return `0 ${unitName}`;
  }
  return `${val.toLocaleString()} ${unitName}`;
};

const parseDisplayFeatures = (val?: string | string[]): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

interface Plan {
  id: string;
  name: string;
  code: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_invoices_per_month: number;
  max_customers?: number;
  max_products?: number;
  allow_khatabook: number | boolean;
  allow_ai_assistant: number | boolean;
  allow_custom_branding: number | boolean;
  display_features?: string | string[];
  badge_tag?: string;
  priority_order?: number;
  is_active: number | boolean;
}

export interface BillingRequest {
  id: string;
  business_id: string;
  business_name: string;
  requested_plan: string;
  price: string;
  utr_ref?: string;
  screenshot_url?: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_response?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  max_uses_per_user?: number;
  uses_count: number;
  valid_until?: string | null;
  is_active: number | boolean;
  created_at?: string;
}

interface PlanManagementProps {
  plans: Plan[];
  onSavePlan: (planData: Partial<Plan>) => Promise<void>;
}

export const PlanManagement: React.FC<PlanManagementProps> = ({ plans, onSavePlan }) => {
  const [activeSubTab, setActiveSubTab] = useState<'tiers' | 'requests' | 'coupons'>('tiers');
  
  // Coupon Management State
  const [coupons, setCoupons] = useState<Coupon[]>([
    {
      id: 'cpn-1',
      code: 'WELCOME50',
      discount_type: 'percentage',
      discount_value: 50,
      min_order_amount: 0,
      max_uses: 100,
      max_uses_per_user: 1,
      uses_count: 14,
      is_active: 1,
    },
    {
      id: 'cpn-2',
      code: 'SAVE500',
      discount_type: 'flat',
      discount_value: 500,
      min_order_amount: 1000,
      max_uses: 50,
      max_uses_per_user: 1,
      uses_count: 8,
      is_active: 1,
    },
    {
      id: 'cpn-3',
      code: 'FESTIVE20',
      discount_type: 'percentage',
      discount_value: 20,
      min_order_amount: 0,
      max_uses: -1,
      max_uses_per_user: -1,
      uses_count: 42,
      is_active: 1,
    },
  ]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({
    code: '',
    discount_type: 'percentage',
    discount_value: 20,
    min_order_amount: 0,
    max_uses: -1,
    max_uses_per_user: 1,
    is_active: 1,
  });

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const res = await fetch('/api/admin/coupons');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setCoupons(json.data);
        }
      }
    } catch (e) {} finally {
      setLoadingCoupons(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleOpenCreateCouponModal = () => {
    setEditingCoupon({
      code: '',
      discount_type: 'percentage',
      discount_value: 20,
      min_order_amount: 0,
      max_uses: -1,
      max_uses_per_user: 1,
      is_active: 1,
    });
    setIsCouponModalOpen(true);
  };


  const handleOpenEditCouponModal = (cpn: Coupon) => {
    setEditingCoupon(cpn);
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon.code || editingCoupon.discount_value === undefined) {
      toast.error('Please specify coupon code and discount value.');
      return;
    }

    const cleanCode = editingCoupon.code.trim().toUpperCase();
    const payload = {
      ...editingCoupon,
      code: cleanCode,
    };

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Coupon "${cleanCode}" saved successfully!`);
        setIsCouponModalOpen(false);
        fetchCoupons();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed to save coupon');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving coupon');
    }
  };

  const handleToggleCouponActive = async (cpn: Coupon) => {
    const newStatus = Number(cpn.is_active) === 1 ? 0 : 1;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cpn, is_active: newStatus }),
      });
      if (res.ok) {
        toast.success(`Coupon "${cpn.code}" is now ${newStatus === 1 ? 'ACTIVE' : 'DISABLED'}.`);
        setCoupons((prev: Coupon[]) => prev.map((c: Coupon) => c.id === cpn.id ? { ...c, is_active: newStatus } : c));
      }
    } catch (e) {
      toast.error('Failed to update coupon status.');
    }
  };

  const handleDeleteCoupon = async (id: string, code: string) => {
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Coupon "${code}" deleted successfully.`);
        setCoupons((prev: Coupon[]) => prev.filter((c: Coupon) => c.id !== id));
      }
    } catch (e) {
      toast.error('Failed to delete coupon.');
    }
  };

  // Plan Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan>>({
    name: '',
    code: '',
    price_monthly: 0,
    price_yearly: 0,
    allow_khatabook: 1,
    allow_ai_assistant: 0,
    allow_custom_branding: 0,
    display_features: '',
    badge_tag: '',
    priority_order: 0,
    is_active: 1,
  });

  const [rawUsers, setRawUsers] = useState('');
  const [rawInvoices, setRawInvoices] = useState('');
  const [rawCustomers, setRawCustomers] = useState('');
  const [rawProducts, setRawProducts] = useState('');

  // Billing Requests state
  const [requests, setRequests] = useState<BillingRequest[]>([
    {
      id: 'REQ-2026-1001',
      business_id: 'biz-01',
      business_name: 'BillingMaster Retail Store',
      requested_plan: 'Starter Business',
      price: '₹499',
      utr_ref: 'UTR98124019284',
      screenshot_url: '',
      status: 'pending',
      admin_response: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Respond Modal state
  const [selectedRequest, setSelectedRequest] = useState<BillingRequest | null>(null);
  const [responseAction, setResponseAction] = useState<'accepted' | 'rejected'>('accepted');
  const [responseNote, setResponseNote] = useState('');
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const fetchBillingRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/admin/billing-requests');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setRequests(json.data);
        }
      }
    } catch (err) {
      // Quiet fallback to initial mock state
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchBillingRequests();
    const interval = setInterval(fetchBillingRequests, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCreateModal = () => {
    // Find next available unused priority number starting from 0
    const usedPriorities = new Set(plans.map(p => Number(p.priority_order) || 0));
    let nextUnusedPriority = 0;
    while (usedPriorities.has(nextUnusedPriority)) {
      nextUnusedPriority++;
    }

    setEditingPlan({
      name: '',
      code: '',
      price_monthly: 0,
      price_yearly: 0,
      allow_khatabook: 1,
      allow_ai_assistant: 0,
      allow_custom_branding: 0,
      display_features: '',
      badge_tag: '',
      priority_order: nextUnusedPriority,
      is_active: 1,
    });
    setRawUsers('');
    setRawInvoices('');
    setRawCustomers('');
    setRawProducts('');
    setIsModalOpen(true);
  };

  const handleEditClick = (plan: Plan) => {
    setEditingPlan({
      ...plan,
      price_monthly: Number(plan.price_monthly) || 0,
      price_yearly: Number(plan.price_yearly) || 0,
      display_features: typeof plan.display_features === 'string' ? plan.display_features : Array.isArray(plan.display_features) ? plan.display_features.join('\n') : '',
      badge_tag: plan.badge_tag || '',
      priority_order: Number(plan.priority_order) || 0,
    });
    setRawUsers(valToRawString(plan.max_users, '3'));
    setRawInvoices(valToRawString(plan.max_invoices_per_month, '500'));
    setRawCustomers(valToRawString(plan.max_customers, '1000'));
    setRawProducts(valToRawString(plan.max_products, '500'));
    setIsModalOpen(true);
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan.name || !editingPlan.code) {
      toast.error('Please specify both plan name and plan code');
      return;
    }

    const targetPriority = Math.max(0, Math.floor(Number(editingPlan.priority_order) || 0));

    // Unique priority order check on client-side
    const conflictingPlan = plans.find(
      (p) => (Number(p.priority_order) || 0) === targetPriority && p.id !== editingPlan.id
    );
    if (conflictingPlan) {
      toast.error(
        `Priority #${targetPriority} is already assigned to plan "${conflictingPlan.name}". Priority numbers must be unique across all plans.`
      );
      return;
    }

    const finalPlan: Partial<Plan> = {
      ...editingPlan,
      price_monthly: Number(editingPlan.price_monthly) || 0,
      price_yearly: Number(editingPlan.price_yearly) || 0,
      max_users: rawStringToVal(rawUsers, -1),
      max_invoices_per_month: rawStringToVal(rawInvoices, -1),
      max_customers: rawStringToVal(rawCustomers, -1),
      max_products: rawStringToVal(rawProducts, -1),
      priority_order: targetPriority,
    };

    try {
      await onSavePlan(finalPlan);
      setIsModalOpen(false);
      toast.success(`Successfully saved plan "${editingPlan.name}" with Priority #${targetPriority}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save plan');
    }
  };

  const handleOpenRespondModal = (reqItem: BillingRequest, action: 'accepted' | 'rejected') => {
    if (reqItem.status !== 'pending') {
      toast.error('This request decision has already been finalized and cannot be modified.');
      return;
    }
    setSelectedRequest(reqItem);
    setResponseAction(action);
    setResponseNote(
      action === 'accepted'
        ? `Payment verified. Your store account has been successfully upgraded to ${reqItem.requested_plan}!`
        : `Payment transaction details could not be verified. Please verify your UTR reference or contact support.`
    );
    setIsRespondModalOpen(true);
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/admin/billing-requests/${selectedRequest.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: responseAction,
          admin_response: responseNote,
        }),
      });

      if (res.ok) {
        setRequests((prev: BillingRequest[]) =>
          prev.map((r: BillingRequest) =>
            r.id === selectedRequest.id
              ? { ...r, status: responseAction, admin_response: responseNote, updated_at: new Date().toISOString() }
              : r
          )
        );
        toast.success(
          responseAction === 'accepted'
            ? `Upgrade request ACCEPTED! Store upgraded to ${selectedRequest.requested_plan}.`
            : `Upgrade request REJECTED successfully.`
        );
        setIsRespondModalOpen(false);
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed to update request response');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network communication error');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const pendingCount = requests.filter((r: BillingRequest) => r.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setActiveSubTab('tiers')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'tiers'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm'
              : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Subscription Plan Studio</span>
        </button>

        <button
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer relative ${
            activeSubTab === 'requests'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm'
              : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Billing & Upgrade Requests</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('coupons')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'coupons'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm'
              : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Manage Promo Coupons</span>
        </button>
      </div>

      {activeSubTab === 'tiers' ? (
        <>
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-400" />
                Subscription Plan Studio
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Create, configure, and adjust subscription pricing tiers, feature gates, and invoice limits.
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New Plan
            </button>
          </div>

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {plans.map((plan) => {
              const isPro = plan.code === 'PRO' || plan.code === 'ENTERPRISE';
              return (
                <div
                  key={plan.id}
                  className={`p-6 rounded-3xl flex flex-col justify-between transition-all relative ${
                    isPro
                      ? 'glass-panel-orange border-orange-500/40 shadow-xl shadow-orange-500/10'
                      : 'bg-neutral-900/70 border border-neutral-800'
                  }`}
                >
                  {(Boolean(plan.badge_tag) || isPro) && (
                    <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>{plan.badge_tag || (isPro ? 'Most Popular' : '')}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-[10px] font-bold uppercase tracking-wider border border-neutral-700">
                          {plan.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px] font-mono font-bold">
                          Priority #{plan.priority_order ?? 0}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          Number(plan.is_active) === 1
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {Number(plan.is_active) === 1 ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>

                    <div className="my-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">₹{plan.price_monthly.toLocaleString()}</span>
                        <span className="text-xs text-neutral-400 font-medium">/ month</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">₹{plan.price_yearly.toLocaleString()} billed annually</p>
                    </div>

                    <div className="space-y-3 border-t border-neutral-800/80 pt-4 text-xs">
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Invoice Limit / Month</span>
                        <span className="font-bold text-white">{formatLimitForCard(plan.max_invoices_per_month, 'Invoices')}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Add Employees Allowed</span>
                        <span className="font-bold text-white">{formatLimitForCard(plan.max_users, 'Employees')}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Max Customers Cap</span>
                        <span className="font-bold text-white">{formatLimitForCard(plan.max_customers, 'Customers')}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Max Products Cap</span>
                        <span className="font-bold text-white">{formatLimitForCard(plan.max_products, 'Products')}</span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>KhataBook Credit Ledger</span>
                        <span className={plan.allow_khatabook ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                          {plan.allow_khatabook ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>AI Assistant & Barcodes</span>
                        <span className={plan.allow_ai_assistant ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                          {plan.allow_ai_assistant ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300">
                        <span>Custom Invoice Branding</span>
                        <span className={plan.allow_custom_branding ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                          {plan.allow_custom_branding ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {parseDisplayFeatures(plan.display_features).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 block mb-1">
                            Display Details & Highlights
                          </span>
                          {parseDisplayFeatures(plan.display_features).map((feature, fIdx) => (
                            <div key={fIdx} className="flex items-start gap-2 text-xs text-neutral-300">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-snug">{feature}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-neutral-800">
                    <button
                      onClick={() => handleEditClick(plan)}
                      className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs border border-neutral-700 transition-all cursor-pointer"
                    >
                      Edit Configuration
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Billing & Upgrade Requests View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-400" />
                Merchant Billing & Upgrade Requests
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Review merchant plan upgrade requests, verify UTR transaction receipts, accept or reject requests, and attach response notes.
              </p>
            </div>
            <button
              onClick={fetchBillingRequests}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs border border-neutral-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin' : ''}`} />
              <span>Refresh Requests</span>
            </button>
          </div>

          {/* Requests Table */}
          <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-950/80 uppercase text-[10px] font-extrabold tracking-wider text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="px-5 py-3.5">Request Info</th>
                    <th className="px-5 py-3.5">Merchant Store</th>
                    <th className="px-5 py-3.5">Requested Plan</th>
                    <th className="px-5 py-3.5">UTR / Ref Code</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-medium">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-neutral-500">
                        No merchant billing requests found.
                      </td>
                    </tr>
                  ) : (
                    requests.map((reqItem) => {
                      const isPending = reqItem.status === 'pending';
                      const isAccepted = reqItem.status === 'accepted';
                      const isRejected = reqItem.status === 'rejected';

                      return (
                        <React.Fragment key={reqItem.id}>
                          <tr className="hover:bg-neutral-800/40 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-white font-mono">{reqItem.id}</div>
                              <div className="text-[11px] text-neutral-500 mt-0.5">
                                {new Date(reqItem.created_at).toLocaleString()}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-bold text-white">{reqItem.business_name}</div>
                              <div className="text-[11px] text-neutral-400 font-mono">ID: {reqItem.business_id}</div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-extrabold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                                {reqItem.requested_plan} ({reqItem.price})
                              </span>
                            </td>

                            <td className="px-5 py-4 font-mono text-neutral-200">
                              {reqItem.utr_ref ? (
                                <span className="bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
                                  {reqItem.utr_ref}
                                </span>
                              ) : (
                                <span className="text-neutral-500">No UTR provided</span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {isPending && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-extrabold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                  Pending Review
                                </span>
                              )}
                              {isAccepted && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Accepted
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px] font-extrabold">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rejected
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenRespondModal(reqItem, 'accepted')}
                                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept</span>
                                  </button>

                                  <button
                                    onClick={() => handleOpenRespondModal(reqItem, 'rejected')}
                                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-end gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-400 text-xs font-bold select-none cursor-not-allowed">
                                  <Lock className="w-3 h-3 text-neutral-500" />
                                  <span>Decision Finalized</span>
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Admin Response Note Sub-Row if present */}
                          {reqItem.admin_response && (
                            <tr className="bg-neutral-950/60 border-b border-neutral-800/80">
                              <td colSpan={6} className="px-5 py-2.5 text-xs">
                                <div className="flex items-start gap-2 text-neutral-300">
                                  <MessageSquare className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold text-orange-400 uppercase text-[10px] tracking-wider mr-2">
                                      Admin Response Note:
                                    </span>
                                    <span className="italic text-neutral-200">{reqItem.admin_response}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Studio Tab View */}
      {activeSubTab === 'coupons' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-400" />
                Promo Coupon Studio
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Create, configure, and track promo discount codes for merchant subscription checkouts.
              </p>
            </div>
            <button
              onClick={handleOpenCreateCouponModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Coupon</span>
            </button>
          </div>

          {/* Coupons Table */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 text-neutral-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-neutral-800">
                  <tr>
                    <th className="px-5 py-3.5">Coupon Code</th>
                    <th className="px-5 py-3.5">Discount Type</th>
                    <th className="px-5 py-3.5">Discount Value</th>
                    <th className="px-5 py-3.5">Min Order Value</th>
                    <th className="px-5 py-3.5">Usage Stats</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/80 text-neutral-300 font-medium">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-neutral-500">
                        No promo coupons created yet. Click "Create New Coupon" to issue discount codes.
                      </td>
                    </tr>
                  ) : (
                    coupons.map((cpn: Coupon) => {
                      const isActive = Number(cpn.is_active) === 1;
                      return (
                        <tr key={cpn.id} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="px-5 py-4 font-mono font-extrabold text-sm text-white">
                            <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 px-3 py-1 rounded-xl">
                              {cpn.code}
                            </span>
                          </td>
                          <td className="px-5 py-4 capitalize font-bold text-neutral-300">
                            {cpn.discount_type === 'percentage' ? '% Percentage Discount' : '₹ Flat Amount OFF'}
                          </td>
                          <td className="px-5 py-4 font-black text-sm text-orange-400">
                            {cpn.discount_type === 'percentage' ? `${cpn.discount_value}% OFF` : `₹${Number(cpn.discount_value).toLocaleString()} OFF`}
                          </td>
                          <td className="px-5 py-4 text-neutral-300">
                            {cpn.min_order_amount > 0 ? `₹${Number(cpn.min_order_amount).toLocaleString()}` : 'No Minimum'}
                          </td>
                          <td className="px-5 py-4 text-neutral-400 font-mono">
                            {cpn.max_uses === -1 ? `${cpn.uses_count || 0} uses (Unlimited)` : `${cpn.uses_count || 0} / ${cpn.max_uses} max uses`}
                          </td>
                          <td className="px-5 py-4">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 text-[11px] font-bold">
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleCouponActive(cpn)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                                  isActive
                                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                {isActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleOpenEditCouponModal(cpn)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(cpn.id, cpn.code)}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30"
                                title="Delete Coupon"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Plan Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5 mb-3 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-400 shrink-0" />
                {editingPlan.id ? 'Edit Plan Configuration' : 'Create New Subscription Plan'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Container */}
            <form onSubmit={handleSubmitPlan} className="flex-1 overflow-y-auto pr-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.name || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="e.g. Starter Business"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Plan Code (UPPERCASE)</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.code || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. STARTER"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Unique Display Priority Rank */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-orange-500/30 space-y-1.5">
                <label className="block text-xs font-extrabold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-orange-400">
                    <Tag className="w-4 h-4 text-orange-500" />
                    <span>Display Priority Order (Unique Rank)</span>
                  </span>
                  <span className="text-[10px] text-orange-400 font-mono font-bold uppercase tracking-wider bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                    Starts from 0 (No Duplicates)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={editingPlan.priority_order ?? 0}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setEditingPlan({ ...editingPlan, priority_order: val });
                  }}
                  placeholder="0"
                  className="w-full bg-[#121217] border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-orange-500"
                />
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Assign a unique priority number starting from <strong className="text-orange-400 font-mono">0</strong> (0 is top priority). Duplicate priority numbers assigned to another plan will be blocked.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingPlan.price_monthly ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Yearly Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingPlan.price_yearly ?? 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-neutral-300">Max Invoices / Month</label>
                    <button
                      type="button"
                      onClick={() => setRawInvoices('U')}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                    >
                      Set U (Unlimited)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rawInvoices}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.toLowerCase() === 'u') setRawInvoices('U');
                      else setRawInvoices(v);
                    }}
                    placeholder="e.g. 500, 0, or type 'U'"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-neutral-300">Max Employees Allowed</label>
                    <button
                      type="button"
                      onClick={() => setRawUsers('U')}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                    >
                      Set U (Unlimited)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rawUsers}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.toLowerCase() === 'u') setRawUsers('U');
                      else setRawUsers(v);
                    }}
                    placeholder="e.g. 3, 0, or type 'U'"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-neutral-300">Max Customers Cap</label>
                    <button
                      type="button"
                      onClick={() => setRawCustomers('U')}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                    >
                      Set U (Unlimited)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rawCustomers}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.toLowerCase() === 'u') setRawCustomers('U');
                      else setRawCustomers(v);
                    }}
                    placeholder="e.g. 1000, 0, or type 'U'"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-neutral-300">Max Products Cap</label>
                    <button
                      type="button"
                      onClick={() => setRawProducts('U')}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold hover:underline cursor-pointer"
                    >
                      Set U (Unlimited)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={rawProducts}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.toLowerCase() === 'u') setRawProducts('U');
                      else setRawProducts(v);
                    }}
                    placeholder="e.g. 500, 0, or type 'U'"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-medium"
                  />
                </div>
              </div>

              {/* Helpful Unlimited Tip Banner */}
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                <span>Tip: Type <code className="bg-neutral-800 text-white px-1.5 py-0.5 rounded font-mono text-xs font-bold">u</code> or <code className="bg-neutral-800 text-white px-1.5 py-0.5 rounded font-mono text-xs font-bold">U</code> (or click <strong>Set U</strong>) for Unlimited. Type <code className="bg-neutral-800 text-white px-1.5 py-0.5 rounded font-mono text-xs font-bold">0</code> to set limit to 0 (Zero).</span>
              </div>

              {/* Plan Highlight Badge / Tag Selector */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                <label className="block text-xs font-bold text-neutral-300">
                  Plan Highlight Badge / Tag <span className="text-neutral-500 font-normal">(Top Card Tag)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'None', val: '' },
                    { label: 'Most Popular ⭐', val: 'Most Popular' },
                    { label: 'Standard', val: 'Standard' },
                    { label: 'Best Value 💎', val: 'Best Value' },
                    { label: 'Recommended 👍', val: 'Recommended' },
                  ].map((item) => {
                    const isSelected = (editingPlan.badge_tag || '') === item.val;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setEditingPlan({ ...editingPlan, badge_tag: item.val })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 border border-orange-400'
                            : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={editingPlan.badge_tag || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, badge_tag: e.target.value })}
                  placeholder="Or type custom badge text (e.g. Starter Choice)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              {/* Feature Checkboxes */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 block mb-1">
                  Feature Entitlements
                </span>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan.allow_khatabook)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, allow_khatabook: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-neutral-900 border-neutral-700"
                  />
                  <span className="text-xs text-neutral-200">Enable KhataBook Ledger Access</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan.allow_ai_assistant)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, allow_ai_assistant: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-neutral-900 border-neutral-700"
                  />
                  <span className="text-xs text-neutral-200">Enable AI Assistant & Barcode Verifier</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan.allow_custom_branding)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, allow_custom_branding: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 bg-neutral-900 border-neutral-700"
                  />
                  <span className="text-xs text-neutral-200">Enable Custom Branding & Logo Print</span>
                </label>
              </div>

              {/* Display Details & Highlights Textarea */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold text-neutral-300">
                    Display Details & Feature Highlights <span className="text-neutral-500 font-normal">(One line per feature)</span>
                  </label>
                  <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                    {parseDisplayFeatures(editingPlan.display_features).length} Highlights
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={typeof editingPlan.display_features === 'string' ? editingPlan.display_features : Array.isArray(editingPlan.display_features) ? editingPlan.display_features.join('\n') : ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, display_features: e.target.value })}
                  placeholder={`e.g.\nUnlimited Invoice Generation\nMulti-User Employee Access\nPriority WhatsApp & Phone Support`}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 font-mono leading-relaxed resize-y"
                />
                <p className="text-[11px] text-neutral-400">
                  Tip: Type each custom feature highlight on a new line. They will be displayed as checkmark bullet points on the subscription pricing card.
                </p>
              </div>

              {/* Sticky Action Footer */}
              <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-neutral-800 shrink-0 sticky bottom-0 bg-neutral-900 z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/20 cursor-pointer transition-all"
                >
                  Save Subscription Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Respond to Billing Request Modal */}
      {isRespondModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                {responseAction === 'accepted' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>
                  {responseAction === 'accepted' ? 'Accept & Upgrade Plan' : 'Reject Billing Request'}
                </span>
              </h3>
              <button
                onClick={() => setIsRespondModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Request Summary Box */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between border-b border-neutral-800/80 pb-2">
                <span className="text-neutral-400">Request ID:</span>
                <span className="font-mono font-bold text-white">{selectedRequest.id}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800/80 pb-2">
                <span className="text-neutral-400">Merchant Store:</span>
                <span className="font-bold text-white">{selectedRequest.business_name}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-800/80 pb-2">
                <span className="text-neutral-400">Requested Plan & Price:</span>
                <span className="font-bold text-orange-400">{selectedRequest.requested_plan} ({selectedRequest.price})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">UTR / Reference Code:</span>
                <span className="font-mono font-bold text-neutral-200">{selectedRequest.utr_ref || 'None'}</span>
              </div>
            </div>

            {/* Response Form */}
            <form onSubmit={handleSubmitResponse} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-200 flex items-center justify-between">
                  <span>Admin Response Note / Text</span>
                  <span className="text-[11px] font-normal text-neutral-400">(Sent back to merchant)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="Enter custom response text note for merchant..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-orange-500 leading-relaxed"
                />
              </div>

              {responseAction === 'accepted' ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Accepting will automatically update merchant store plan to <strong>{selectedRequest.requested_plan}</strong>.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Rejecting will mark request as rejected. The store plan will remain unchanged.</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRespondModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-lg cursor-pointer transition-all disabled:opacity-50 ${
                    responseAction === 'accepted'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  }`}
                >
                  {submittingResponse
                    ? 'Submitting...'
                    : responseAction === 'accepted'
                    ? 'Confirm Accept & Upgrade'
                    : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Coupon Modal */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col my-auto space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-400 shrink-0" />
                {editingCoupon.id ? 'Edit Promo Coupon' : 'Create New Promo Coupon'}
              </h3>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Coupon Code (UPPERCASE)</label>
                <input
                  type="text"
                  required
                  value={editingCoupon.code || ''}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAVE20, FESTIVE500, WELCOME100"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-orange-500 uppercase tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">Discount Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingCoupon({ ...editingCoupon, discount_type: 'percentage' })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editingCoupon.discount_type === 'percentage'
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCoupon({ ...editingCoupon, discount_type: 'flat' })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editingCoupon.discount_type === 'flat'
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      ₹ Flat OFF
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">
                    Discount Value ({editingCoupon.discount_type === 'percentage' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingCoupon.discount_value ?? 20}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, discount_value: Number(e.target.value) })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingCoupon.min_order_amount ?? 0}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, min_order_amount: Number(e.target.value) })}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0 for No Minimum"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-medium focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Coupon Active Status</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingCoupon({ ...editingCoupon, is_active: Number(editingCoupon.is_active) === 1 ? 0 : 1 })}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
                      Number(editingCoupon.is_active) === 1
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {Number(editingCoupon.is_active) === 1 ? '● Active Coupon' : '○ Disabled'}
                  </button>
                </div>
              </div>

              {/* Usage & Redemption Limits Box */}
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                  Usage & Redemption Limits
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-300">Total Global Uses</label>
                      <span className="text-[10px] text-neutral-500 font-mono">-1 = Unlimited</span>
                    </div>
                    <input
                      type="number"
                      value={editingCoupon.max_uses ?? -1}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, max_uses: Number(e.target.value) })}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="-1 for Unlimited"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-medium focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-neutral-300">Max Uses Per User</label>
                      <span className="text-[10px] text-neutral-500 font-mono">-1 = Unlimited</span>
                    </div>
                    <input
                      type="number"
                      value={editingCoupon.max_uses_per_user ?? 1}
                      onChange={(e) => setEditingCoupon({ ...editingCoupon, max_uses_per_user: Number(e.target.value) })}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="1 for Single Use per User"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white font-medium focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 cursor-pointer transition-all"
                >
                  Save Promo Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
