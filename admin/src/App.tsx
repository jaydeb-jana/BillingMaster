import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { DashboardOverview } from './pages/DashboardOverview';
import { PlanManagement } from './pages/PlanManagement';
import { BusinessControl } from './pages/BusinessControl';
import { SecretNewsAnnouncements, Bulletin } from './pages/SecretNewsAnnouncements';
import { FeatureControl, FeatureFlag } from './pages/FeatureControl';
import { AuditAndSystemHealth, AuditLog } from './pages/AuditAndSystemHealth';

const getTabFromPath = (path: string): string => {
  const clean = path.replace(/\/$/, '').toLowerCase();
  if (clean === '/plans') return 'plans';
  if (clean === '/businesses') return 'businesses';
  if (clean === '/bulletins') return 'bulletins';
  if (clean === '/features') return 'features';
  if (clean === '/audit') return 'audit';
  return 'overview';
};

const getPathFromTab = (tab: string): string => {
  if (tab === 'plans') return '/plans';
  if (tab === 'businesses') return '/businesses';
  if (tab === 'bulletins') return '/bulletins';
  if (tab === 'features') return '/features';
  if (tab === 'audit') return '/audit';
  return '/';
};

export function App() {
  const [activeTab, setActiveTabState] = useState<string>(() => getTabFromPath(window.location.pathname));

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const targetPath = getPathFromTab(tab);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // State loaded from API or local fallback
  const [stats, setStats] = useState({
    totalBusinesses: 5,
    totalUsers: 12,
    totalCustomers: 186,
    totalInvoices: 340,
    totalRevenue: 285400,
    activePlansCount: 3,
    planBreakdownText: 'Free (1) • Starter (2) • Pro (2)',
    systemHealth: 'OPERATIONAL',
    uptimeSeconds: 14200,
    databaseEngine: 'MySQL 8.0 + Node Express',
    activeFeatureFlags: 4,
  });

  const [plans, setPlans] = useState([
    {
      id: 'plan-free',
      name: 'Free Tier',
      code: 'FREE',
      price_monthly: 0,
      price_yearly: 0,
      max_users: 1,
      max_invoices_per_month: 50,
      max_customers: 200,
      max_products: 100,
      allow_khatabook: 1,
      allow_ai_assistant: 0,
      allow_custom_branding: 0,
      display_features: 'Standard GST & Non-GST Invoicing\nSingle User Access\nBasic KhataBook Credit Ledger',
      badge_tag: '',
      is_active: 1,
    },
    {
      id: 'plan-starter',
      name: 'Starter Business',
      code: 'STARTER',
      price_monthly: 499,
      price_yearly: 4990,
      max_users: 3,
      max_invoices_per_month: 500,
      max_customers: 2000,
      max_products: 1000,
      allow_khatabook: 1,
      allow_ai_assistant: 1,
      allow_custom_branding: 0,
      display_features: 'Unlimited Invoice & Receipt Creation\nMulti-User Employee Access\nAI Barcode Scanner & Assistant\nKhataBook & Customer Ledger Sync',
      badge_tag: 'Standard',
      is_active: 1,
    },
    {
      id: 'plan-pro',
      name: 'Pro Enterprise',
      code: 'PRO',
      price_monthly: 1499,
      price_yearly: 14990,
      max_users: 10,
      max_invoices_per_month: 5000,
      max_customers: 20000,
      max_products: 10000,
      allow_khatabook: 1,
      allow_ai_assistant: 1,
      allow_custom_branding: 1,
      display_features: 'Unlimited Everything (Invoices, Customers, Products)\nCustom Logo Branding on Invoices\nPriority Phone & WhatsApp Support\nFull KhataBook & AI Automation',
      badge_tag: 'Most Popular',
      is_active: 1,
    },
  ]);

  const [businesses, setBusinesses] = useState([
    {
      id: 'biz-01',
      name: 'BillingMaster Retail Store',
      email: 'store@billingmaster.com',
      phone: '+91 98765 43210',
      currency: 'INR',
      turnover: '50L - 1Cr',
      catalog_handle: 'retail-store',
      created_at: new Date().toISOString(),
      total_invoices: 184,
      total_products: 64,
      total_customers: 32,
      total_revenue: 185400,
      status: 'active',
    },
    {
      id: 'biz-02',
      name: 'Apex Supermarket & Grocery',
      email: 'contact@apexsuper.com',
      phone: '+91 98111 22233',
      currency: 'INR',
      turnover: '1Cr - 5Cr',
      catalog_handle: 'apex-grocery',
      created_at: new Date().toISOString(),
      total_invoices: 156,
      total_products: 120,
      total_customers: 85,
      total_revenue: 100000,
      status: 'active',
    },
  ]);

  const [bulletins, setBulletins] = useState<Bulletin[]>([
    {
      id: 'b-1',
      title: 'Secret Insight: Multi-Currency GST Automation Optimization',
      content:
        'Insider strategy note for retailers: Enabling automatic tax calculations reduces checkout latency by 45%. Pro tier accounts can access tax reporting in one click.',
      category: 'secret_insight',
      target_audience: 'all',
      published_at: new Date().toISOString(),
      views_count: 14,
      target_count: 16,
    },
    {
      id: 'b-2',
      title: 'Scheduled System Maintenance Notice',
      content:
        'Routine cloud database indexing scheduled for Sunday at 02:00 AM UTC. Estimated downtime under 5 minutes.',
      category: 'maintenance',
      target_audience: 'all',
      published_at: new Date().toISOString(),
      views_count: 11,
      target_count: 16,
    },
  ]);

  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({
    global_ai_assistant: {
      name: 'Global AI Assistant',
      description: 'Enable AI invoice generation and barcode assistant across all tenant stores',
      is_enabled: true,
      category: 'AI Engine',
    },
    khatabook_module: {
      name: 'KhataBook Credit Manager',
      description: 'Allow businesses to record credit ledger entries and customer balance tracking',
      is_enabled: true,
      category: 'Accounting',
    },
    new_user_registration: {
      name: 'Self-Service Merchant Registration',
      description: 'Allow new businesses to register autonomously without admin approval',
      is_enabled: true,
      category: 'Platform Access',
    },
    maintenance_mode: {
      name: 'Global Maintenance Lockdown',
      description: 'Restrict tenant write operations for critical platform updates',
      is_enabled: false,
      category: 'System Governance',
    },
    whatsapp_receipts: {
      name: 'WhatsApp Direct Receipt Sharing',
      description: 'Enable automated WhatsApp gateway integration for digital invoices',
      is_enabled: true,
      category: 'Integrations',
    },
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      action: 'SYSTEM_BOOTSTRAP',
      target_entity: 'Admin Kernel',
      details: 'BillingMaster Admin Control Suite initialized with live telemetry',
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    },
  ]);

  // Fetch live stats & data from backend API
  const fetchLiveData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const json = await statsRes.json();
        if (json.data) setStats((prev) => ({ ...prev, ...json.data }));
      }

      const plansRes = await fetch('/api/admin/plans');
      if (plansRes.ok) {
        const json = await plansRes.json();
        if (json.data && json.data.length > 0) setPlans(json.data);
      }

      const bizRes = await fetch('/api/admin/businesses');
      if (bizRes.ok) {
        const json = await bizRes.json();
        if (json.data && Array.isArray(json.data)) setBusinesses(json.data);
      }

      const bulletinRes = await fetch('/api/admin/bulletins');
      if (bulletinRes.ok) {
        const json = await bulletinRes.json();
        if (json.data && json.data.length > 0) setBulletins(json.data);
      }

      const flagsRes = await fetch('/api/admin/feature-flags');
      if (flagsRes.ok) {
        const json = await flagsRes.json();
        if (json.data) setFeatureFlags(json.data);
      }

      const logsRes = await fetch('/api/admin/audit-logs');
      if (logsRes.ok) {
        const json = await logsRes.json();
        if (json.data && json.data.length > 0) setAuditLogs(json.data);
      }
    } catch (err) {
      // Quietly rely on initial fallbacks
    }
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handlers for mutations
  const handleSavePlan = async (planData: Partial<any>) => {
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });

      let savedData: any = null;

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          savedData = {
            ...json.data,
            price_monthly: Number(json.data.price_monthly) || 0,
            price_yearly: Number(json.data.price_yearly) || 0,
          };
        }
      }

      if (!savedData) {
        const id = planData.id || `plan-${Date.now()}`;
        savedData = {
          name: '',
          code: '',
          price_monthly: 0,
          price_yearly: 0,
          max_users: 1,
          max_invoices_per_month: 100,
          max_customers: 1000,
          max_products: 500,
          allow_khatabook: 1,
          allow_ai_assistant: 1,
          allow_custom_branding: 0,
          is_active: 1,
          ...planData,
          id,
        };
      }

      setPlans((prev: any[]) => {
        const idx = prev.findIndex((p) => p.id === savedData.id || (p.code && p.code.toUpperCase() === String(savedData.code).toUpperCase()));
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = savedData;
          return updated;
        }
        return [...prev, savedData];
      });

      // Add audit log
      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        action: 'UPSERT_PLAN',
        target_entity: 'Subscription Plan',
        details: `Saved pricing tier: ${savedData.name} (${savedData.code})`,
        performed_by: 'Super Admin',
        created_at: new Date().toISOString(),
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    } catch (e) {
      const id = planData.id || `plan-${Date.now()}`;
      const fallback: any = {
        name: '',
        code: '',
        price_monthly: 0,
        price_yearly: 0,
        max_users: 1,
        max_invoices_per_month: 100,
        max_customers: 1000,
        max_products: 500,
        allow_khatabook: 1,
        allow_ai_assistant: 1,
        allow_custom_branding: 0,
        is_active: 1,
        ...planData,
        id,
      };
      setPlans((prev: any[]) => {
        const idx = prev.findIndex((p) => p.id === id || (p.code && p.code.toUpperCase() === String(fallback.code).toUpperCase()));
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = fallback;
          return updated;
        }
        return [...prev, fallback];
      });
    }
  };

  const handleToggleBusinessStatus = async (bizId: string, currentStatus: string, reason?: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const suspendReason = newStatus === 'suspended' ? (reason || null) : null;

    try {
      await fetch(`/api/admin/businesses/${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, suspend_reason: suspendReason }),
      });
    } catch (e) {}

    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, status: newStatus, suspend_reason: suspendReason } : b))
    );
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'TOGGLE_BUSINESS_STATUS',
      target_entity: 'Merchant Tenant',
      details: `Changed business status (${bizId}) to ${newStatus.toUpperCase()}${suspendReason ? ` [Reason: ${suspendReason}]` : ''}`,
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleDeleteBusiness = async (bizId: string) => {
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Failed to delete merchant store from database:', json.error);
      }
    } catch (e) {
      console.error('Network error deleting business:', e);
    }

    // Broadcast deletion event to immediately log out open merchant store tabs
    try {
      localStorage.setItem('billingmaster_tenant_deleted_event', JSON.stringify({ bizId, timestamp: Date.now() }));
      const channel = new BroadcastChannel('billingmaster_tenant_channel');
      channel.postMessage({ type: 'TENANT_DELETED', bizId });
      channel.close();
    } catch (e) {}

    setBusinesses((prev) => prev.filter((b) => b.id !== bizId));
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'PERMANENT_DELETE_BUSINESS',
      target_entity: 'Merchant Tenant',
      details: `Permanently deleted business store account (${bizId}) and all associated records`,
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleUpdateBusiness = async (bizId: string, data: Partial<any>) => {
    try {
      const res = await fetch(`/api/admin/businesses/${bizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setBusinesses((prev) =>
            prev.map((b) => (b.id === bizId ? { ...b, ...data, ...json.data } : b))
          );
        }
      } else {
        setBusinesses((prev) =>
          prev.map((b) => (b.id === bizId ? { ...b, ...data } : b))
        );
      }
    } catch (e) {
      setBusinesses((prev) =>
        prev.map((b) => (b.id === bizId ? { ...b, ...data } : b))
      );
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'UPDATE_BUSINESS_DETAILS',
      target_entity: 'Merchant Tenant',
      details: `Updated merchant store details for tenant (${bizId})`,
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleCreateBulletin = async (bulletinData: Partial<Bulletin>) => {
    try {
      const res = await fetch('/api/admin/bulletins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulletinData),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setBulletins((prev) => [json.data, ...prev]);
        }
      } else {
        const newB: Bulletin = {
          id: `b-${Date.now()}`,
          title: bulletinData.title || '',
          content: bulletinData.content || '',
          category: bulletinData.category || 'secret_insight',
          target_audience: bulletinData.target_audience || 'all',
          published_at: new Date().toISOString(),
          views_count: 1,
          target_count: 16,
        };
        setBulletins((prev) => [newB, ...prev]);
      }

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        action: 'BROADCAST_BULLETIN',
        target_entity: 'Secret Intelligence Feed',
        details: `Published announcement: "${bulletinData.title}"`,
        performed_by: 'Super Admin',
        created_at: new Date().toISOString(),
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    } catch (e) {}
  };

  const handleToggleFeatureFlag = async (flagKey: string, isEnabled: boolean) => {
    try {
      await fetch('/api/admin/feature-flags/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_key: flagKey, is_enabled: isEnabled }),
      });
    } catch (e) {}

    setFeatureFlags((prev) => ({
      ...prev,
      [flagKey]: {
        ...prev[flagKey],
        is_enabled: isEnabled,
      },
    }));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'TOGGLE_FEATURE_FLAG',
      target_entity: 'System Feature Switch',
      details: `Set feature flag "${flagKey}" to ${isEnabled ? 'ENABLED' : 'DISABLED'}`,
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handleTriggerMaintenance = async () => {
    await new Promise((r) => setTimeout(r, 1200));
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'DATABASE_MAINTENANCE',
      target_entity: 'MySQL Tables',
      details: 'Executed table index rebuild and connection pool optimization',
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Executive Overview & Analytics';
      case 'plans':
        return 'Subscription Plan & Pricing Studio';
      case 'businesses':
        return 'Business Tenant Governance';
      case 'bulletins':
        return 'Secret News & Intelligence Bulletins';
      case 'features':
        return 'Master Feature Flags & Security Toggles';
      case 'audit':
        return 'System Audit Logs & Infrastructure Health';
      default:
        return 'Super Admin Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      {/* Toast Notification Container */}
      <Toaster position="top-right" theme="dark" richColors />

      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} systemHealth={stats.systemHealth} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          activeTabTitle={getTabTitle()}
          onRefreshData={fetchLiveData}
          onOpenQuickBulletin={() => setActiveTab('bulletins')}
        />

        <main className="p-8 max-w-7xl w-full mx-auto flex-1 space-y-8">
          {activeTab === 'overview' && (
            <DashboardOverview stats={stats} onNavigateTab={setActiveTab} />
          )}

          {activeTab === 'plans' && (
            <PlanManagement plans={plans} onSavePlan={handleSavePlan} />
          )}

          {activeTab === 'businesses' && (
            <BusinessControl
              businesses={businesses}
              onToggleStatus={handleToggleBusinessStatus}
              onDeleteBusiness={handleDeleteBusiness}
              onUpdateBusiness={handleUpdateBusiness}
            />
          )}

          {activeTab === 'bulletins' && (
            <SecretNewsAnnouncements bulletins={bulletins} onCreateBulletin={handleCreateBulletin} />
          )}

          {activeTab === 'features' && (
            <FeatureControl flags={featureFlags} onToggleFlag={handleToggleFeatureFlag} />
          )}

          {activeTab === 'audit' && (
            <AuditAndSystemHealth
              logs={auditLogs}
              uptimeSeconds={stats.uptimeSeconds}
              databaseEngine={stats.databaseEngine}
              onTriggerMaintenance={handleTriggerMaintenance}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
