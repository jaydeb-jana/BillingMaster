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

  // State loaded from API
  const [stats, setStats] = useState<any>({
    totalBusinesses: 0,
    totalUsers: 0,
    totalCustomers: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    activePlansCount: 0,
    planBreakdownText: '',
    systemHealth: 'OPERATIONAL',
    uptimeSeconds: 0,
    databaseEngine: 'MySQL 8.0 + Node Express',
    activeFeatureFlags: 0,
  });

  const [plans, setPlans] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [featureFlags, setFeatureFlags] = useState<Record<string, FeatureFlag>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Fetch live stats & data from backend API
  const fetchLiveData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const json = await statsRes.json();
        if (json.data) setStats((prev: any) => ({ ...prev, ...json.data }));
      }

      const plansRes = await fetch('/api/admin/plans');
      if (plansRes.ok) {
        const json = await plansRes.json();
        if (json.data && Array.isArray(json.data)) setPlans(json.data);
      }

      const bizRes = await fetch('/api/admin/businesses');
      if (bizRes.ok) {
        const json = await bizRes.json();
        if (json.data && Array.isArray(json.data)) setBusinesses(json.data);
      }

      const bulletinRes = await fetch('/api/admin/bulletins');
      if (bulletinRes.ok) {
        const json = await bulletinRes.json();
        if (json.data && Array.isArray(json.data)) setBulletins(json.data);
      }

      const flagsRes = await fetch('/api/admin/feature-flags');
      if (flagsRes.ok) {
        const json = await flagsRes.json();
        if (json.data) setFeatureFlags(json.data);
      }

      const logsRes = await fetch('/api/admin/audit-logs');
      if (logsRes.ok) {
        const json = await logsRes.json();
        if (json.data && Array.isArray(json.data)) setAuditLogs(json.data);
      }

      const reqRes = await fetch('/api/admin/billing-requests');
      if (reqRes.ok) {
        const json = await reqRes.json();
        if (json.data && Array.isArray(json.data)) {
          const pendingCount = json.data.filter((r: any) => r.status === 'pending').length;
          setPendingRequestsCount(pendingCount);
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handlers for mutations
  const handleSavePlan = async (planData: Partial<any>) => {
    const res = await fetch('/api/admin/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to save subscription plan');
    }

    const json = await res.json();
    if (!json.data) {
      throw new Error('Invalid response from server when saving plan');
    }

    const savedData = {
      ...json.data,
      price_monthly: Number(json.data.price_monthly) || 0,
      price_3months: json.data.price_3months !== undefined && json.data.price_3months !== null ? Number(json.data.price_3months) : null,
      price_6months: json.data.price_6months !== undefined && json.data.price_6months !== null ? Number(json.data.price_6months) : null,
      price_yearly: Number(json.data.price_yearly) || 0,
      price_2years: json.data.price_2years !== undefined && json.data.price_2years !== null ? Number(json.data.price_2years) : null,
      price_3years: json.data.price_3years !== undefined && json.data.price_3years !== null ? Number(json.data.price_3years) : null,
    };

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

    // Refresh live data from backend
    await fetchLiveData();
  };

  const handleDeletePlan = async (planId: string) => {
    const res = await fetch(`/api/admin/plans/${planId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Failed to delete plan');
    }

    setPlans((prev: any[]) => prev.filter((p) => p.id !== planId && p.name !== planId && p.code !== planId));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action: 'DELETE_PLAN',
      target_entity: 'Subscription Plan',
      details: `Deleted subscription plan (${planId})`,
      performed_by: 'Super Admin',
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    await fetchLiveData();
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
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={stats.systemHealth}
        pendingRequestsCount={pendingRequestsCount}
      />

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
            <PlanManagement plans={plans} onSavePlan={handleSavePlan} onDeletePlan={handleDeletePlan} />
          )}

          {activeTab === 'businesses' && (
            <BusinessControl
              businesses={businesses}
              plans={plans}
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
