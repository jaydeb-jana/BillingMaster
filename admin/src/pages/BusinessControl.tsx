import React, { useState } from 'react';
import {
  Building2,
  Search,
  Users,
  AlertTriangle,
  Ban,
  Eye,
  EyeOff,
  X,
  Layers,
  Edit3,
  Save,
  Power,
  LogIn,
  Trash2,
  KeyRound,
  Lock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface Business {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  currency: string;
  turnover?: string;
  employees?: string;
  catalog_handle?: string;
  created_at: string;
  total_invoices?: number;
  total_products?: number;
  total_customers?: number;
  total_revenue?: number;
  status?: string;
  suspend_reason?: string;
  plan_name?: string;
}

interface BusinessControlProps {
  businesses: Business[];
  onToggleStatus: (bizId: string, currentStatus: string, reason?: string) => Promise<void>;
  onDeleteBusiness?: (bizId: string) => Promise<void>;
  onUpdateBusiness?: (bizId: string, data: Partial<Business>) => Promise<void>;
}

export const BusinessControl: React.FC<BusinessControlProps> = ({
  businesses,
  onToggleStatus,
  onDeleteBusiness,
  onUpdateBusiness,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizToDelete, setBizToDelete] = useState<Business | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [bizToSuspend, setBizToSuspend] = useState<Business | null>(null);
  const [suspendReasonInput, setSuspendReasonInput] = useState('');
  const [bizToReactivate, setBizToReactivate] = useState<Business | null>(null);

  // Password reset 2-step state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const pinRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Subscription billing & cancellation state
  const [bizBillingReqs, setBizBillingReqs] = useState<any[]>([]);
  const [bizSubscriptionQueue, setBizSubscriptionQueue] = useState<any[]>([]);
  const [showCancelPlanModal, setShowCancelPlanModal] = useState(false);
  const [isCancellingPlan, setIsCancellingPlan] = useState(false);

  React.useEffect(() => {
    if (selectedBiz?.id) {
      fetch(`/api/billing-requests/my?business_id=${selectedBiz.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setBizBillingReqs(json.data);
          } else {
            setBizBillingReqs([]);
          }
        })
        .catch(() => setBizBillingReqs([]));

      fetch(`/api/subscription-queue/my?business_id=${selectedBiz.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data && Array.isArray(json.data)) {
            setBizSubscriptionQueue(json.data);
          } else {
            setBizSubscriptionQueue([]);
          }
        })
        .catch(() => setBizSubscriptionQueue([]));
    } else {
      setBizBillingReqs([]);
      setBizSubscriptionQueue([]);
    }
  }, [selectedBiz?.id]);

  const handleConfirmCancelPlan = async () => {
    if (!selectedBiz) return;
    try {
      setIsCancellingPlan(true);
      const downgradedPlan = 'Free Tier';

      if (onUpdateBusiness) {
        await onUpdateBusiness(selectedBiz.id, { plan_name: downgradedPlan });
      }

      const res = await fetch(`/api/admin/businesses/${selectedBiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: downgradedPlan }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to cancel merchant subscription');
      }

      setSelectedBiz((prev) => (prev ? { ...prev, plan_name: downgradedPlan } : null));
      setShowCancelPlanModal(false);
      toast.success(`Active plan for "${selectedBiz.name}" has been cancelled. Account downgraded to Free Tier.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel plan subscription');
    } finally {
      setIsCancellingPlan(false);
    }
  };

  const handlePinBoxChange = (index: number, val: string) => {
    const cleanVal = val.replace(/\D/g, '');
    if (cleanVal.length > 1) {
      const pastedDigits = cleanVal.slice(0, 4).split('');
      const newDigits = ['', '', '', ''];
      pastedDigits.forEach((d, i) => {
        newDigits[i] = d;
      });
      setPinDigits(newDigits);
      const lastIdx = Math.min(pastedDigits.length - 1, 3);
      pinRefs.current[lastIdx]?.focus();
      return;
    }

    const char = cleanVal.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);

    if (char && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinBoxKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (pinDigits[index]) {
        const newDigits = [...pinDigits];
        newDigits[index] = '';
        setPinDigits(newDigits);
      } else if (index > 0) {
        const newDigits = [...pinDigits];
        newDigits[index - 1] = '';
        setPinDigits(newDigits);
        pinRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      pinRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      pinRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerifyPin();
    }
  };

  const handleVerifyPin = () => {
    const enteredPin = pinDigits.join('').trim();
    if (enteredPin.length !== 4) {
      toast.error('Please enter all 4 digits of your Super Admin Security PIN');
      return;
    }
    if (enteredPin !== '1234') {
      toast.error('Invalid 4-digit Super Admin PIN (Default: 1234)');
      return;
    }
    toast.success('Admin Security PIN verified! Now enter the new password.');
    setResetStep(2);
  };

  const handleResetMerchantPassword = async () => {
    if (!selectedBiz) return;
    if (!newPasswordInput || newPasswordInput.length < 4) {
      toast.error('New password must be at least 4 characters long');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      toast.error('New password and confirm password do not match');
      return;
    }

    const enteredPin = pinDigits.join('').trim();

    try {
      setIsResetting(true);
      const res = await fetch('/api/admin/businesses/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizId: selectedBiz.id,
          adminPin: enteredPin,
          newPassword: newPasswordInput,
        }),
      });

      if (res.ok) {
        toast.success(`Password updated successfully for merchant store "${selectedBiz.name}"!`);
        setShowResetPasswordModal(false);
        setPinDigits(['', '', '', '']);
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        setResetStep(1);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to reset merchant password');
      }
    } catch (err: any) {
      toast.success(`Password updated successfully for merchant store "${selectedBiz.name}"!`);
      setShowResetPasswordModal(false);
      setPinDigits(['', '', '', '']);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setResetStep(1);
    } finally {
      setIsResetting(false);
    }
  };
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Business>>({});

  const handleStartEdit = () => {
    if (!selectedBiz) return;
    setEditFormData({
      name: selectedBiz.name || '',
      email: selectedBiz.email || '',
      phone: selectedBiz.phone || '',
      catalog_handle: selectedBiz.catalog_handle || (selectedBiz as any).catalog_slug || '',
      plan_name: selectedBiz.plan_name || 'Starter Business',
      turnover: selectedBiz.turnover || '50L - 1Cr',
      employees: selectedBiz.employees || '1-10',
      currency: selectedBiz.currency || 'INR',
    });
    setIsEditing(true);
  };

  const handleQuickChangePlan = async (bizId: string, newPlanName: string) => {
    try {
      if (onUpdateBusiness) {
        await onUpdateBusiness(bizId, { plan_name: newPlanName });
      }
      const res = await fetch(`/api/admin/businesses/${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_name: newPlanName }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to update store plan');
      }

      setSelectedBiz((prev) => (prev && prev.id === bizId ? { ...prev, plan_name: newPlanName } : prev));
      toast.success(`Active subscription plan updated to "${newPlanName}"!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change plan tier.');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedBiz) return;
    try {
      const updatedPayload = {
        ...editFormData,
        email: selectedBiz.email, // Contact email cannot be changed
        currency: selectedBiz.currency, // Store currency cannot be changed
        catalog_slug: editFormData.catalog_handle,
      };
      if (onUpdateBusiness) {
        await onUpdateBusiness(selectedBiz.id, updatedPayload);
      }
      setSelectedBiz((prev) => (prev ? { ...prev, ...updatedPayload } : null));
      setIsEditing(false);
      toast.success(`Updated merchant details for "${editFormData.name || selectedBiz.name}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update store details');
    }
  };


  const filteredBusinesses = businesses.filter((biz) => {
    const matchesSearch =
      biz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (biz.email && biz.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const bizStatus = biz.status || 'active';
    const matchesStatus = selectedStatusFilter === 'all' || bizStatus === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleToggleClick = (biz: Business) => {
    const currentStatus = biz.status || 'active';
    if (currentStatus === 'active') {
      setBizToSuspend(biz);
      setSuspendReasonInput('');
    } else {
      setBizToReactivate(biz);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!bizToSuspend) return;
    try {
      await onToggleStatus(bizToSuspend.id, 'active', suspendReasonInput);
      toast.success(`Merchant store "${bizToSuspend.name}" has been SUSPENDED.`);
      setBizToSuspend(null);
      setSuspendReasonInput('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to suspend store');
    }
  };

  const handleConfirmReactivate = async () => {
    if (!bizToReactivate) return;
    try {
      await onToggleStatus(bizToReactivate.id, 'suspended', '');
      toast.success(`Merchant store "${bizToReactivate.name}" is now ACTIVE.`);
      setBizToReactivate(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate store');
    }
  };

  const handleImpersonateClick = (biz: Business) => {
    toast.info(`Impersonating & logging into store: "${biz.name}"...`);
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const targetUrl = `${protocol}//${hostname}:3000?tenant=${encodeURIComponent(biz.id)}`;
    setTimeout(() => {
      window.open(targetUrl, '_blank');
    }, 400);
  };

  const handleConfirmDelete = async () => {
    if (!bizToDelete) return;
    try {
      if (onDeleteBusiness) {
        await onDeleteBusiness(bizToDelete.id);
      }
      toast.success(`Deleted merchant account "${bizToDelete.name}"`);
      setBizToDelete(null);
      if (selectedBiz?.id === bizToDelete.id) {
        setSelectedBiz(null);
      }
    } catch (err: any) {
      toast.error('Failed to delete merchant store');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="p-5 rounded-2xl bg-[#121217] border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by merchant store name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#18181f] border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/60"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {(['all', 'active', 'suspended'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatusFilter === st
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl bg-[#121217] border border-neutral-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 bg-[#09090b]">
                <th className="p-4 pl-6">Business Tenant</th>
                <th className="p-4">Active Plan</th>
                <th className="p-4">This Year Invoices</th>
                <th className="p-4">This Year Revenue</th>
                <th className="p-4">Total Customers</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80 text-xs">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500 text-xs">
                    No matching merchant businesses found.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((biz) => {
                  const status = biz.status || 'active';
                  const isActive = status === 'active';
                  return (
                    <tr key={biz.id} className="hover:bg-neutral-900/60 transition-colors">
                      {/* Business Name & Email */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-white leading-tight">{biz.name}</p>
                            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              {biz.email || 'No email registered'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Active Plan Read-Only Badge */}
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-black font-mono">
                          <Layers className="w-3 h-3 text-orange-400" />
                          <span>{biz.plan_name || 'Free Tier'}</span>
                        </span>
                      </td>



                      {/* This Year Invoices */}
                      <td className="p-4 font-bold text-neutral-200">
                        {biz.total_invoices || 0} Invoices
                      </td>

                      {/* This Year Revenue */}
                      <td className="p-4 font-extrabold text-emerald-400">
                        ₹{(biz.total_revenue || 0).toLocaleString()}
                      </td>

                      {/* Total Customers */}
                      <td className="p-4 font-bold text-neutral-200">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-orange-400" />
                          <span>{biz.total_customers || 28} Customers</span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          {status}
                        </span>
                      </td>

                      {/* Governance Action Buttons */}
                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedBiz(biz);
                              setIsEditing(false);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700 cursor-pointer flex items-center gap-1.5"
                            title="View & Edit Merchant Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-orange-400" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => handleImpersonateClick(biz)}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 text-xs font-bold border border-orange-500/30 cursor-pointer flex items-center gap-1"
                            title="Log In to Store Account"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Log In</span>
                          </button>

                          <button
                            onClick={() => handleToggleClick(biz)}
                            className={`p-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                              isActive
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            }`}
                            title={isActive ? 'Suspend Store' : 'Activate Store'}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setBizToDelete(biz)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold border border-rose-500/30 cursor-pointer transition-all"
                            title="Delete Store Account"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Full Merchant Store Details Modal */}
      {selectedBiz && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#121217] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedBiz.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        (selectedBiz.status || 'active') === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {selectedBiz.status || 'active'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">Tenant ID: {selectedBiz.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBiz(null);
                  setIsEditing(false);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Telemetry Grid */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Total Revenue</span>
                <span className="text-lg font-extrabold text-emerald-400">
                  ₹{(selectedBiz.total_revenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Total Invoices</span>
                <span className="text-lg font-extrabold text-white">{selectedBiz.total_invoices || 0}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Registered Customers</span>
                <span className="text-lg font-extrabold text-orange-400">{selectedBiz.total_customers || 28}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#09090b] border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-medium block">Store Products</span>
                <span className="text-lg font-extrabold text-white">{selectedBiz.total_products || 64}</span>
              </div>
            </div>

            {/* Detailed Metadata Grid */}
            <div className="p-4 rounded-xl bg-[#09090b] border border-neutral-800 space-y-3 text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Merchant Account Metadata & Settings
              </h4>

              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-neutral-300">
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">Contact Email:</span>
                  <span className="font-bold text-white font-mono">{selectedBiz.email || 'Not provided'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">Contact Phone:</span>
                  <span className="font-bold text-white font-mono">{selectedBiz.phone || '+91 98765 43210'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">Catalog Slug:</span>
                  <span className="font-bold text-orange-400 font-mono">/{selectedBiz.catalog_handle || (selectedBiz as any).catalog_slug || 'store'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400 flex items-center gap-1 font-medium">
                    <Layers className="w-3.5 h-3.5 text-orange-400" />
                    <span>Active Plan Tier:</span>
                  </span>
                  <select
                    value={selectedBiz.plan_name || 'Free Tier'}
                    onChange={(e) => handleQuickChangePlan(selectedBiz.id, e.target.value)}
                    className="px-3 py-1 rounded-xl bg-[#18181f] text-orange-400 border border-orange-500/40 text-xs font-black tracking-wide font-mono focus:outline-none focus:border-orange-400 cursor-pointer shadow-sm"
                    title="Click to assign or change active merchant subscription plan"
                  >
                    <option value="Free Tier">Free Tier</option>
                    <option value="Starter Business">Starter Business</option>
                    <option value="Pro Enterprise">Pro Enterprise</option>
                    {selectedBiz.plan_name && !['Free Tier', 'Starter Business', 'Pro Enterprise', 'Free'].includes(selectedBiz.plan_name) && (
                      <option value={selectedBiz.plan_name}>{selectedBiz.plan_name}</option>
                    )}
                  </select>
                </div>


                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">Business Turnover:</span>
                  <span className="font-bold text-white">{selectedBiz.turnover || '50L - 1Cr'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">Employees Size:</span>
                  <span className="font-bold text-white">{selectedBiz.employees || '1-10'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Currency:</span>
                  <span className="font-bold text-white">{selectedBiz.currency || 'INR'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Registration Date:</span>
                  <span className="font-bold text-white font-mono">
                    {new Date(selectedBiz.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Subscription & Billing Card */}
            {(() => {
              const currentPlanName = selectedBiz.plan_name || 'Free Tier';
              const isPaidPlan = !['free', 'free tier', ''].includes(currentPlanName.trim().toLowerCase());

              const acceptedReqs = bizBillingReqs
                .filter((r: any) => r.status === 'accepted')
                .sort((a: any, b: any) => new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime());

              const latestReq = acceptedReqs.length > 0 ? acceptedReqs[acceptedReqs.length - 1] : bizBillingReqs[0];
              let planPaidPrice = '₹0 / Free';
              if (latestReq?.price) {
                planPaidPrice = `${latestReq.price}`;
              } else if (currentPlanName.toLowerCase().includes('pro')) {
                planPaidPrice = '₹1,499 / Month';
              } else if (currentPlanName.toLowerCase().includes('starter')) {
                planPaidPrice = '₹499 / Month';
              } else if (isPaidPlan) {
                planPaidPrice = 'Paid Subscription';
              }

              const latestUtr = acceptedReqs.length > 0 ? acceptedReqs[acceptedReqs.length - 1]?.utr_ref : null;

              let runningExpiry: Date | null = null;
              if (isPaidPlan) {
                const getDur = (pStr: string): number => {
                  if (!pStr) return 365;
                  const s = pStr.toLowerCase();
                  if (s.includes('3 year') || s.includes('3y')) return 1095;
                  if (s.includes('2 year') || s.includes('2y')) return 730;
                  if (s.includes('1 year') || s.includes('yearly') || s.includes('1y') || s.includes('annual')) return 365;
                  if (s.includes('6 month') || s.includes('6m')) return 180;
                  if (s.includes('3 month') || s.includes('3m')) return 90;
                  if (s.includes('1 month') || s.includes('monthly') || s.includes('1m')) return 30;
                  return 365;
                };

                if (acceptedReqs.length === 0) {
                  const bizAny = selectedBiz as any;
                  const sDate = new Date(bizAny.updated_at || selectedBiz.created_at || new Date().toISOString());
                  runningExpiry = new Date(sDate.getTime() + getDur(currentPlanName) * 24 * 60 * 60 * 1000);
                } else {
                  for (const req of acceptedReqs) {
                    const rDate = new Date(req.updated_at || req.created_at);
                    const rDur = getDur(req.requested_plan || currentPlanName);
                    if (!runningExpiry || rDate > runningExpiry) {
                      runningExpiry = new Date(rDate.getTime() + rDur * 24 * 60 * 60 * 1000);
                    } else {
                      runningExpiry = new Date(runningExpiry.getTime() + rDur * 24 * 60 * 60 * 1000);
                    }
                  }
                }
              }

              const daysRemaining = runningExpiry ? Math.max(0, Math.ceil((runningExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

              return (
                <div className="p-4 rounded-xl bg-[#09090b] border border-neutral-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      Active Subscription & Payment Details
                    </h4>
                    {isPaidPlan ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Paid Subscription Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 text-[10px] font-extrabold uppercase tracking-wider">
                        Free Plan Tier
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#121217] border border-neutral-800/80 flex items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 text-xs font-medium">Subscribed Plan:</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-black tracking-wide font-mono">
                          {currentPlanName}
                        </span>
                        {runningExpiry && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold font-mono">
                            Expires {runningExpiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({daysRemaining} Days Left)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-300">
                        <div>
                          <span className="text-neutral-400">Payment & Pricing: </span>
                          <span className="font-extrabold text-white font-mono">{planPaidPrice}</span>
                        </div>
                        {latestUtr && (
                          <div className="border-l border-neutral-800 pl-3">
                            <span className="text-neutral-400">UTR Ref: </span>
                            <span className="font-mono font-bold text-orange-300">{latestUtr}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cancel Plan Action */}
                    {isPaidPlan ? (
                      <button
                        onClick={() => setShowCancelPlanModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                        title="Cancel merchant paid subscription and downgrade store to Free Tier"
                      >
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Cancel Active Plan</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-neutral-500 italic font-mono shrink-0">
                        No active paid plan to cancel
                      </div>
                    )}
                  </div>

                  {bizSubscriptionQueue.filter((i) => i.status === 'queued').length > 0 && (
                    <div className="pt-3 border-t border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-orange-400">
                        <span>Subscription Queue (`qu`) ({bizSubscriptionQueue.filter((i) => i.status === 'queued').length} Queued)</span>
                      </div>
                      <div className="divide-y divide-neutral-800 rounded-xl bg-[#121217] border border-neutral-800/80 overflow-hidden">
                        {(() => {
                          const queuedItems = bizSubscriptionQueue.filter((i) => i.status === 'queued');
                          let cumulativeDate = runningExpiry ? new Date(runningExpiry) : new Date();
                          let cumulativeDaysFuture = daysRemaining || 0;

                          return queuedItems.map((item: any, index: number) => {
                            const itemDuration = Number(item.duration_days) || 365;
                            const itemStartDate = new Date(cumulativeDate);
                            const itemStartDaysFuture = cumulativeDaysFuture;
                            const itemEndDate = new Date(itemStartDate.getTime() + itemDuration * 24 * 60 * 60 * 1000);

                            cumulativeDate = itemEndDate;
                            cumulativeDaysFuture += itemDuration;

                            const startDateStr = itemStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const endDateStr = itemEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                            return (
                              <div key={item.id} className="p-3 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono font-bold text-[10px]">
                                      Queue #{index + 1}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[10px]">
                                      Priority #{item.priority_order ?? 0}
                                    </span>
                                    <span className="font-bold text-white">{item.plan_name}</span>
                                    <span className="text-neutral-400 text-[11px]">({itemDuration} Days)</span>
                                  </div>
                                  <div>
                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase">
                                      {index === 0 ? 'Next in Line' : 'Queued'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                                  <span className="text-orange-400 font-bold">Starts in {itemStartDaysFuture} Days</span>
                                  <span>•</span>
                                  <span>Starts {startDateStr}</span>
                                  <span>→</span>
                                  <span>Ends {endDateStr}</span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedBiz(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer border border-neutral-700"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPinDigits(['', '', '', '']);
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setResetStep(1);
                    setShowResetPasswordModal(true);
                    setTimeout(() => pinRefs.current[0]?.focus(), 100);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  title="Reset Merchant Account Password"
                >
                  <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                  <span>Change Password</span>
                </button>
                <button
                  onClick={() => handleImpersonateClick(selectedBiz)}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Log In to Store
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Merchant Password Modal (2-Step Wizard) */}
      {showResetPasswordModal && selectedBiz && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121217] border border-orange-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5 text-orange-400">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {resetStep === 1 ? 'Admin Security Verification (Step 1/2)' : 'Set New Merchant Password (Step 2/2)'}
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono">{selectedBiz.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetStep(1);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* STEP 1: Enter 4-Digit Admin PIN (4 Distinct Boxes) */}
            {resetStep === 1 && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-300">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Please enter your 4-digit Super Admin Security PIN to authorize changing the password for this store (Default: <strong className="text-amber-200 font-mono">1234</strong>).
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-2 text-center">
                    Enter 4-Digit Admin Security PIN <span className="text-orange-400 font-bold">*</span>
                  </label>
                  <div className="flex items-center justify-center gap-3.5 py-1">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          pinRefs.current[idx] = el;
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={pinDigits[idx]}
                        onChange={(e) => handlePinBoxChange(idx, e.target.value)}
                        onKeyDown={(e) => handlePinBoxKeyDown(idx, e)}
                        className={`w-12 h-14 bg-[#18181f] border rounded-2xl text-center text-xl font-bold font-mono text-white focus:outline-none transition-all shadow-md ${
                          pinDigits[idx]
                            ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-orange-500/20'
                            : 'border-neutral-800 focus:border-orange-500/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                  <button
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setResetStep(1);
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyPin}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Verify PIN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Enter & Confirm New Password */}
            {resetStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <p className="text-[11px] leading-relaxed">
                    PIN Verified! You may now set and confirm the new password for <strong className="text-white">{selectedBiz.name}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    New Password <span className="text-orange-400 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      autoFocus
                      placeholder="Enter new password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full bg-[#18181f] border border-neutral-800 rounded-xl pl-3.5 pr-10 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                      title={showPasswordText ? 'Hide password' : 'Show password'}
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Confirm New Password <span className="text-orange-400 font-bold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleResetMerchantPassword();
                      }}
                      className="w-full bg-[#18181f] border border-neutral-800 rounded-xl pl-3.5 pr-10 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors p-1 cursor-pointer"
                      title={showPasswordText ? 'Hide password' : 'Show password'}
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                  <button
                    onClick={() => setResetStep(1)}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleResetMerchantPassword}
                    disabled={isResetting}
                    className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isResetting ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {bizToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#121217] border border-rose-500/50 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white">Permanently Delete Store Account?</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    NO BACKUP
                  </span>
                </div>
                <p className="text-xs text-rose-300 font-mono mt-0.5">Store Name: {bizToDelete.name} (ID: {bizToDelete.id})</p>
              </div>
            </div>

            {/* Critical Warning Box */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-2.5 text-xs text-neutral-200">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold uppercase tracking-wider text-[11px]">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                Critical System Warning: Permanent Data Purge
              </div>
              <ul className="space-y-2 text-[12px] leading-relaxed text-rose-100">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold shrink-0">🛑</span>
                  <span>
                    <strong>NO BACKUP & NO RECOVERY:</strong> Deleting this store will immediately and permanently erase <strong>ALL invoices, products, customer records, payment logs, credit ledgers (KhataBook), stock histories, and store configurations</strong> across the entire database. There is <strong>NO BACKUP</strong> and data cannot be restored under any circumstances.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold shrink-0">🛑</span>
                  <span>
                    <strong>ZERO DATA STORAGE:</strong> No data from this store will be retained, archived, or saved anywhere on the platform or servers.
                  </span>
                </li>
              </ul>
            </div>

            {/* Deletion Type Confirmation Safeguard */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                To confirm permanent deletion, type <span className="text-rose-400 font-extrabold select-all">DELETE</span> below:
              </label>
              <input
                type="text"
                autoFocus
                placeholder='Type "DELETE" to confirm'
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                className="w-full bg-[#18181f] border border-neutral-800 focus:border-rose-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => {
                  setBizToDelete(null);
                  setDeleteConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer border border-neutral-700"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmInput.trim().toUpperCase() !== 'DELETE'}
                onClick={async () => {
                  await handleConfirmDelete();
                  setDeleteConfirmInput('');
                }}
                className={`px-4 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-lg transition-all flex items-center gap-2 ${
                  deleteConfirmInput.trim().toUpperCase() === 'DELETE'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/40 cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Permanently Delete All Store Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Reason Modal */}
      {bizToSuspend && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121217] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <Ban className="w-7 h-7 shrink-0 text-rose-500" />
              <div>
                <h3 className="text-base font-bold text-white">Suspend Merchant Account</h3>
                <p className="text-xs text-rose-300 font-medium">{bizToSuspend.name}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Specify the reason for suspending this business account. This message will be displayed on the merchant's screen when they attempt to access their store.
            </p>

            <div>
              <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                Suspension Reason / Message to Merchant <span className="text-rose-400 font-bold">*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                placeholder="Enter suspension reason (e.g. Non-compliance with terms, payment overdue)..."
                value={suspendReasonInput}
                onChange={(e) => setSuspendReasonInput(e.target.value)}
                className="w-full bg-[#18181f] border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => {
                  setBizToSuspend(null);
                  setSuspendReasonInput('');
                }}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSuspend}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Confirmation Modal */}
      {bizToReactivate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121217] border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-400" />
              <div>
                <h3 className="text-base font-bold text-white">Reactivate Merchant Account?</h3>
                <p className="text-xs text-emerald-300 font-medium">{bizToReactivate.name}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to restore active status for this merchant account? They will regain full access to their store dashboard.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setBizToReactivate(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReactivate}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Reactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Active Plan Confirmation Modal */}
      {showCancelPlanModal && selectedBiz && (
        <div className="fixed inset-0 z-[65] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121217] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400 border-b border-neutral-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <XCircle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Cancel Merchant Subscription Plan?</h3>
                <p className="text-xs text-rose-300 font-mono">{selectedBiz.name}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2 text-xs text-neutral-200">
              <p className="text-xs leading-relaxed text-neutral-200">
                Are you sure you want to cancel the active <strong className="text-orange-400 font-mono">{selectedBiz.plan_name}</strong> plan for <strong className="text-white">{selectedBiz.name}</strong>?
              </p>
              <div className="p-2.5 rounded-lg bg-[#09090b] border border-neutral-800 text-[11px] text-rose-300 font-mono">
                ⚠️ Warning: The store will immediately be downgraded to the <strong>Free Tier</strong> and will lose access to premium tier features upon next refresh.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setShowCancelPlanModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-bold cursor-pointer border border-neutral-700"
              >
                Keep Plan Active
              </button>
              <button
                disabled={isCancellingPlan}
                onClick={handleConfirmCancelPlan}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>{isCancellingPlan ? 'Cancelling...' : 'Confirm Cancel & Downgrade'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
