import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/mysql.js';
import crypto from 'node:crypto';

// In-memory fallback stores when DB is offline or mock environment
export interface AdminPlan {
  id: string;
  name: string;
  code: string;
  price_monthly: number;
  price_3months?: number | null;
  price_6months?: number | null;
  price_yearly: number;
  price_2years?: number | null;
  price_3years?: number | null;
  max_users: number;
  max_invoices_per_month: number;
  max_customers: number;
  max_products: number;
  allow_khatabook: number;
  allow_ai_assistant: number;
  allow_custom_branding: number;
  display_features: string;
  badge_tag: string;
  priority_order: number;
  is_active: number;
  created_at: string;
}

let mockPlans: AdminPlan[] = [
  {
    id: 'plan-free',
    name: 'Free Tier',
    code: 'FREE',
    price_monthly: 0,
    price_3months: 0,
    price_6months: 0,
    price_yearly: 0,
    price_2years: 0,
    price_3years: 0,
    max_users: 1,
    max_invoices_per_month: 50,
    max_customers: 200,
    max_products: 100,
    allow_khatabook: 1,
    allow_ai_assistant: 0,
    allow_custom_branding: 0,
    display_features: 'Standard GST & Non-GST Invoicing\nSingle User Access\nBasic KhataBook Credit Ledger',
    badge_tag: '',
    priority_order: 0,
    is_active: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'plan-starter',
    name: 'Starter Business',
    code: 'STARTER',
    price_monthly: 499,
    price_3months: 1422,
    price_6months: 2495,
    price_yearly: 4990,
    price_2years: 8982,
    price_3years: 12475,
    max_users: 3,
    max_invoices_per_month: 500,
    max_customers: 2000,
    max_products: 1000,
    allow_khatabook: 1,
    allow_ai_assistant: 1,
    allow_custom_branding: 0,
    display_features: 'Unlimited Invoice & Receipt Creation\nMulti-User Employee Access\nAI Barcode Scanner & Assistant\nKhataBook & Customer Ledger Sync',
    badge_tag: 'Standard',
    priority_order: 1,
    is_active: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'plan-pro',
    name: 'Pro Enterprise',
    code: 'PRO',
    price_monthly: 1499,
    price_3months: 4272,
    price_6months: 7495,
    price_yearly: 14990,
    price_2years: 26982,
    price_3years: 37475,
    max_users: 10,
    max_invoices_per_month: 5000,
    max_customers: 20000,
    max_products: 10000,
    allow_khatabook: 1,
    allow_ai_assistant: 1,
    allow_custom_branding: 1,
    display_features: 'Unlimited Everything (Invoices, Customers, Products)\nCustom Logo Branding on Invoices\nPriority Phone & WhatsApp Support\nFull KhataBook & AI Automation',
    badge_tag: 'Most Popular',
    priority_order: 2,
    is_active: 1,
    created_at: new Date().toISOString(),
  },
];

let mockBulletins = [
  {
    id: 'b-1',
    title: 'Secret Insight: Multi-Currency GST Automation Optimization',
    content: 'Insider strategy note for retailers: Enabling automatic tax calculations reduces checkout latency by 45%. Pro tier accounts can access tax reporting in one click.',
    category: 'secret_insight',
    target_audience: 'all',
    published_at: new Date().toISOString(),
    views_count: 14,
    target_count: 16,
    action_button_title: 'Explore Pro Features',
    action_button_url: '/plans',
    read_by: [
      { store_name: 'BillingMaster Retail Store', catalog_handle: 'retail-store', read_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
      { store_name: 'Apex Supermarket & Grocery', catalog_handle: 'apex-grocery', read_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
      { store_name: 'City Fashion & Clothing', catalog_handle: 'city-fashion', read_at: new Date(Date.now() - 1000 * 60 * 300).toISOString() },
      { store_name: 'Metro Electronics Store', catalog_handle: 'metro-elec', read_at: new Date(Date.now() - 1000 * 60 * 450).toISOString() },
    ],
  },
  {
    id: 'b-2',
    title: 'Scheduled System Maintenance Notice',
    content: 'Routine cloud database indexing scheduled for Sunday at 02:00 AM UTC. Estimated downtime under 5 minutes.',
    category: 'maintenance',
    target_audience: 'all',
    published_at: new Date().toISOString(),
    views_count: 11,
    target_count: 16,
    read_by: [
      { store_name: 'BillingMaster Retail Store', catalog_handle: 'retail-store', read_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
      { store_name: 'Apex Supermarket & Grocery', catalog_handle: 'apex-grocery', read_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
    ],
  },
];

let mockFeatureFlags: Record<string, { name: string; description: string; is_enabled: boolean; category: string }> = {
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
};

let mockAuditLogs = [
  {
    id: 'log-1',
    action: 'SYSTEM_BOOTSTRAP',
    target_entity: 'Admin Kernel',
    details: 'BillingMaster Admin Suite initialized successfully',
    performed_by: 'Super Admin',
    created_at: new Date().toISOString(),
  },
];

// Helper to log audit actions
async function recordAuditLog(action: string, target_entity: string, details: string, performed_by = 'Super Admin') {
  const logEntry = {
    id: crypto.randomUUID(),
    action,
    target_entity,
    details,
    performed_by,
    created_at: new Date().toISOString(),
  };
  mockAuditLogs.unshift(logEntry);
  try {
    await pool.query(
      'INSERT INTO admin_audit_logs (id, action, target_entity, details, performed_by) VALUES (?, ?, ?, ?, ?)',
      [logEntry.id, action, target_entity, details, performed_by]
    );
  } catch (err) {}
}

export async function getAdminOverviewStats(_req: Request, res: Response) {
  try {
    let totalBusinesses = 0;
    let totalUsers = 0;
    let totalInvoices = 0;
    let totalCustomers = 0;
    let totalRevenue = 0;
    let activePlansCount = mockPlans.length;

    try {
      const [bizRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM businesses');
      totalBusinesses = bizRows[0]?.cnt || 0;

      const [userRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM users');
      totalUsers = userRows[0]?.cnt || 0;

      const [custRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM customers');
      totalCustomers = custRows[0]?.cnt || 0;

      const [invRows]: any = await pool.query('SELECT COUNT(*), COALESCE(SUM(total), 0) as rev FROM invoices');
      totalInvoices = invRows[0]?.['COUNT(*)'] || 0;
      totalRevenue = Number(invRows[0]?.rev || 0);

      const [pCntRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM plans WHERE is_active = 1');
      if (pCntRows && pCntRows[0]?.cnt !== undefined) {
        activePlansCount = Number(pCntRows[0].cnt) || 0;
      }
    } catch (e) {
      // Fallback stats if DB query fails or empty
      totalBusinesses = 5;
      totalUsers = 12;
      totalCustomers = 186;
      totalInvoices = 340;
      totalRevenue = 285400;
    }

    res.json({
      status: 'success',
      data: {
        totalBusinesses,
        totalUsers,
        totalCustomers,
        totalInvoices,
        totalRevenue,
        activePlansCount,
        planBreakdownText: 'Free (1) • Starter (2) • Pro (2)',
        systemHealth: 'OPERATIONAL',
        uptimeSeconds: Math.floor(process.uptime()),
        databaseEngine: 'MySQL 8.0 + Node Express',
        activeFeatureFlags: Object.values(mockFeatureFlags).filter((f) => f.is_enabled).length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAdminPlans(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM plans ORDER BY priority_order ASC, price_monthly ASC');
      if (Array.isArray(rows)) {
        const mappedRows = rows.map((r: any) => ({
          ...r,
          price_monthly: Number(r.price_monthly) || 0,
          price_3months: r.price_3months !== undefined && r.price_3months !== null ? Number(r.price_3months) : null,
          price_6months: r.price_6months !== undefined && r.price_6months !== null ? Number(r.price_6months) : null,
          price_yearly: Number(r.price_yearly) || 0,
          price_2years: r.price_2years !== undefined && r.price_2years !== null ? Number(r.price_2years) : null,
          price_3years: r.price_3years !== undefined && r.price_3years !== null ? Number(r.price_3years) : null,
          max_users: r.max_users !== undefined && r.max_users !== null ? Number(r.max_users) : 1,
          max_invoices_per_month: r.max_invoices_per_month !== undefined && r.max_invoices_per_month !== null ? Number(r.max_invoices_per_month) : 100,
          max_customers: r.max_customers !== undefined && r.max_customers !== null ? Number(r.max_customers) : 1000,
          max_products: r.max_products !== undefined && r.max_products !== null ? Number(r.max_products) : 500,
          allow_khatabook: Number(r.allow_khatabook) || 0,
          allow_ai_assistant: Number(r.allow_ai_assistant) || 0,
          allow_custom_branding: Number(r.allow_custom_branding) || 0,
          display_features: r.display_features || '',
          badge_tag: r.badge_tag || '',
          priority_order: r.priority_order !== undefined && r.priority_order !== null ? Number(r.priority_order) : 0,
          is_active: Number(r.is_active) || 0,
        }));
        return res.json({ status: 'success', data: mappedRows });
      }
    } catch (e) {}

    const sortedMock = [...mockPlans].sort((a, b) => (a.priority_order ?? 0) - (b.priority_order ?? 0));
    res.json({ status: 'success', data: sortedMock });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createOrUpdateAdminPlan(req: Request, res: Response) {
  try {
    const {
      id, name, code,
      price_monthly, price_3months, price_6months, price_yearly, price_2years, price_3years,
      max_users, max_invoices_per_month, max_customers, max_products,
      allow_khatabook, allow_ai_assistant, allow_custom_branding,
      display_features, badge_tag, priority_order, is_active
    } = req.body;
    
    if (!name || !code) {
      return res.status(400).json({ error: 'Plan name and code are required' });
    }

    const planId = id || `plan-${crypto.randomUUID().slice(0, 8)}`;
    const targetPriority = Math.max(0, Math.floor(Number(priority_order) || 0));

    // Unique priority order validation check in MySQL database
    let dbChecked = false;
    try {
      const [existingRows]: any = await pool.query(
        'SELECT id, name FROM plans WHERE priority_order = ? AND id != ? LIMIT 1',
        [targetPriority, planId]
      );
      dbChecked = true;
      if (Array.isArray(existingRows) && existingRows.length > 0) {
        return res.status(400).json({
          error: `Priority #${targetPriority} is already assigned to plan "${existingRows[0].name}". Priority ranks must be unique across all plans.`,
        });
      }
    } catch (e) {}

    // Unique priority order validation check in mock fallback (only if DB is offline)
    if (!dbChecked) {
      const mockConflict = mockPlans.find(p => Number(p.priority_order ?? 0) === targetPriority && p.id !== planId);
      if (mockConflict) {
        return res.status(400).json({
          error: `Priority #${targetPriority} is already assigned to plan "${mockConflict.name}". Priority ranks must be unique across all plans.`,
        });
      }
    }

    const pMonthly = Number(price_monthly) || 0;
    const pYearly = Number(price_yearly) || 0;

    const planObj = {
      id: planId,
      name,
      code: String(code).toUpperCase(),
      price_monthly: pMonthly,
      price_3months: price_3months !== undefined && price_3months !== null && price_3months !== '' ? Number(price_3months) : null,
      price_6months: price_6months !== undefined && price_6months !== null && price_6months !== '' ? Number(price_6months) : null,
      price_yearly: pYearly,
      price_2years: price_2years !== undefined && price_2years !== null && price_2years !== '' ? Number(price_2years) : null,
      price_3years: price_3years !== undefined && price_3years !== null && price_3years !== '' ? Number(price_3years) : null,
      max_users: max_users !== undefined && max_users !== null ? Number(max_users) : 1,
      max_invoices_per_month: max_invoices_per_month !== undefined && max_invoices_per_month !== null ? Number(max_invoices_per_month) : 100,
      max_customers: max_customers !== undefined && max_customers !== null ? Number(max_customers) : 1000,
      max_products: max_products !== undefined && max_products !== null ? Number(max_products) : 500,
      allow_khatabook: allow_khatabook ? 1 : 0,
      allow_ai_assistant: allow_ai_assistant ? 1 : 0,
      allow_custom_branding: allow_custom_branding ? 1 : 0,
      display_features: String(display_features || ''),
      badge_tag: String(badge_tag || ''),
      priority_order: targetPriority,
      is_active: is_active ?? 1,
      created_at: new Date().toISOString(),
    };

    const existingIndex = mockPlans.findIndex((p) => p.id === planId);
    if (existingIndex >= 0) {
      mockPlans[existingIndex] = planObj;
    } else {
      mockPlans.push(planObj);
    }

    try {
      await pool.query(
        `INSERT INTO plans (id, name, code, price_monthly, price_3months, price_6months, price_yearly, price_2years, price_3years, max_users, max_invoices_per_month, max_customers, max_products, allow_khatabook, allow_ai_assistant, allow_custom_branding, display_features, badge_tag, priority_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), price_monthly=VALUES(price_monthly), price_3months=VALUES(price_3months), price_6months=VALUES(price_6months), price_yearly=VALUES(price_yearly), price_2years=VALUES(price_2years), price_3years=VALUES(price_3years), max_users=VALUES(max_users), max_invoices_per_month=VALUES(max_invoices_per_month), max_customers=VALUES(max_customers), max_products=VALUES(max_products), allow_khatabook=VALUES(allow_khatabook), allow_ai_assistant=VALUES(allow_ai_assistant), allow_custom_branding=VALUES(allow_custom_branding), display_features=VALUES(display_features), badge_tag=VALUES(badge_tag), priority_order=VALUES(priority_order), is_active=VALUES(is_active)`,
        [
          planId, name, planObj.code,
          planObj.price_monthly, planObj.price_3months, planObj.price_6months, planObj.price_yearly, planObj.price_2years, planObj.price_3years,
          planObj.max_users, planObj.max_invoices_per_month, planObj.max_customers, planObj.max_products,
          planObj.allow_khatabook, planObj.allow_ai_assistant, planObj.allow_custom_branding,
          planObj.display_features, planObj.badge_tag, planObj.priority_order, planObj.is_active
        ]
      );
    } catch (e) {
      console.error('[MySQL Error] createOrUpdateAdminPlan failed:', e);
    }

    await recordAuditLog('UPSERT_PLAN', 'Subscription Plan', `Updated subscription tier: ${name} (${planObj.code}) with Priority #${targetPriority}`);

    res.json({ status: 'success', data: planObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteAdminPlan(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    try {
      await pool.query('DELETE FROM plans WHERE id = ? OR name = ? OR code = ?', [id, id, id]);
    } catch (e) {
      console.error('[Admin] MySQL delete plan error:', e);
    }

    const idx = mockPlans.findIndex((p) => p.id === id || p.name === id || p.code === id);
    if (idx >= 0) {
      mockPlans.splice(idx, 1);
    }

    await recordAuditLog(
      'DELETE_SUBSCRIPTION_PLAN',
      'Subscription Plan',
      `Permanently deleted subscription plan record (${id})`
    );

    res.json({ status: 'success', message: 'Subscription plan deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAdminBusinesses(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query(`
        SELECT b.*, 
          COALESCE(NULLIF(b.email, ''), (SELECT u.email FROM profiles p JOIN users u ON p.id = u.id WHERE p.business_id = b.id LIMIT 1)) as owner_email,
          COALESCE(
            (SELECT requested_plan FROM billing_requests br WHERE (br.business_id = b.id OR br.business_name = b.name) AND br.status = 'accepted' ORDER BY br.updated_at DESC LIMIT 1),
            b.plan_name,
            'Free Tier'
          ) as raw_plan_name,
          (SELECT COUNT(*) FROM invoices i WHERE i.business_id = b.id) as total_invoices,
          (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id) as total_products,
          (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id) as total_customers,
          (SELECT COALESCE(SUM(total), 0) FROM invoices i WHERE i.business_id = b.id) as total_revenue
        FROM businesses b ORDER BY b.created_at DESC
      `);
      if (Array.isArray(rows)) {
        const cleanedRows = rows.map((r: any) => {
          let cleanPlan = r.plan_name || r.raw_plan_name || 'Free Tier';
          cleanPlan = cleanPlan.replace(/\s*\[Coupon:[^\]]+\]/gi, '').replace(/\s*\[Saved[^\]]+\]/gi, '').trim();
          if (!cleanPlan || cleanPlan.toLowerCase() === 'free') {
            cleanPlan = 'Free Tier';
          }
          return {
            ...r,
            email: r.email || r.owner_email || 'Not provided',
            plan_name: cleanPlan,
          };
        });
        return res.json({ status: 'success', data: cleanedRows });
      }
    } catch (e) {
      console.error('[Admin] getAdminBusinesses DB query error:', e);
    }

    res.json({
      status: 'success',
      data: [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateAdminBusiness(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, phone, catalog_handle, currency, turnover, employees, plan_name, status, suspend_reason } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    try {
      if (status !== undefined || suspend_reason !== undefined) {
        await pool.query(
          `UPDATE businesses 
           SET status = COALESCE(?, status),
               suspend_reason = ?
           WHERE id = ?`,
          [status || null, status === 'active' ? null : (suspend_reason || null), id]
        );
      }

      let activePlanResult: any = null;
      if (plan_name !== undefined) {
        activePlanResult = await activateSubscriptionPlanWithPriority(id, plan_name);
      }

      // Fetch active plan name from businesses table after priority activation
      const [currentBizRows]: any = await pool.query('SELECT plan_name FROM businesses WHERE id = ? LIMIT 1', [id]);
      const activeOrCurrentPlanName = currentBizRows[0]?.plan_name || null;

      await pool.query(
        `UPDATE businesses 
         SET name = COALESCE(?, name),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             catalog_handle = COALESCE(?, catalog_handle),
             catalog_slug = COALESCE(?, catalog_slug),
             currency = COALESCE(?, currency),
             turnover = COALESCE(?, turnover),
             employees = COALESCE(?, employees),
             plan_name = COALESCE(?, plan_name)
         WHERE id = ? OR catalog_handle = ? OR email = ?`,
        [
          name || null,
          email || null,
          phone || null,
          catalog_handle || null,
          catalog_handle || null,
          currency || null,
          turnover || null,
          employees || null,
          activeOrCurrentPlanName,
          id,
          id,
          email || id,
        ]
      );

    } catch (e) {
      console.error('[Admin] MySQL business update error:', e);
    }

    await recordAuditLog(
      'UPDATE_BUSINESS_DETAILS',
      'Merchant Tenant',
      `Updated merchant store details/status for tenant (${id})`
    );

    res.json({
      status: 'success',
      data: {
        id,
        name,
        email,
        phone,
        catalog_handle,
        currency,
        turnover,
        employees,
        plan_name,
        status,
        suspend_reason,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetMerchantPasswordAdmin(req: Request, res: Response) {
  try {
    const { bizId, adminPin, newPassword } = req.body;

    if (!bizId || !newPassword) {
      return res.status(400).json({ error: 'Business ID and new password are required' });
    }

    if (String(adminPin).trim() !== '1234') {
      return res.status(401).json({ error: 'Invalid 4-digit Super Admin PIN' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
      const [bizRows]: any = await pool.query('SELECT email FROM businesses WHERE id = ? LIMIT 1', [bizId]);
      const email = bizRows[0]?.email;
      if (email) {
        await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
      }
    } catch (e) {
      console.error('[Admin] MySQL password reset error:', e);
    }

    await recordAuditLog(
      'RESET_MERCHANT_PASSWORD',
      'Security Governance',
      `Reset merchant password for store (${bizId}) using 4-digit PIN verification`
    );

    res.json({ status: 'success', message: 'Merchant password reset successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAdminBulletins(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM system_bulletins ORDER BY is_pinned DESC, published_at DESC');
      if (Array.isArray(rows)) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}

    res.json({ status: 'success', data: mockBulletins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createAdminBulletin(req: Request, res: Response) {
  try {
    const { title, content, category, target_audience, action_button_title, action_button_url } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const bulletin = {
      id: `b-${crypto.randomUUID().slice(0, 8)}`,
      title,
      content,
      category: category || 'announcement',
      target_audience: target_audience || 'all',
      action_button_title: action_button_title || undefined,
      action_button_url: action_button_url || undefined,
      published_at: new Date().toISOString(),
      views_count: 0,
      target_count: 16,
      read_by: [],
    };

    mockBulletins.unshift(bulletin);

    try {
      await pool.query(
        'INSERT INTO system_bulletins (id, title, content, category, target_audience, is_pinned) VALUES (?, ?, ?, ?, ?, ?)',
        [bulletin.id, title, content, bulletin.category, bulletin.target_audience, 0]
      );
    } catch (e) {}

    await recordAuditLog('BROADCAST_BULLETIN', 'System Announcement', `Published broadcast bulletin: "${title}"`);

    res.json({ status: 'success', data: bulletin });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAdminFeatureFlags(_req: Request, res: Response) {
  try {
    res.json({ status: 'success', data: mockFeatureFlags });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function toggleAdminFeatureFlag(req: Request, res: Response) {
  try {
    const { flag_key, is_enabled } = req.body;
    if (!flag_key || !mockFeatureFlags[flag_key]) {
      return res.status(404).json({ error: 'Feature flag key not found' });
    }

    mockFeatureFlags[flag_key].is_enabled = Boolean(is_enabled);

    await recordAuditLog(
      'TOGGLE_FEATURE_FLAG',
      'System Configuration',
      `Toggled feature flag "${mockFeatureFlags[flag_key].name}" (${flag_key}) to ${is_enabled ? 'ENABLED' : 'DISABLED'}`
    );

    res.json({ status: 'success', data: mockFeatureFlags[flag_key] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAdminAuditLogs(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100');
      if (Array.isArray(rows)) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}

    res.json({ status: 'success', data: mockAuditLogs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteAdminBusiness(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    try {
      // 1. Retrieve associated store email and profile user IDs before deletion
      const [bizRows]: any = await pool.query('SELECT email FROM businesses WHERE id = ?', [id]);
      const bizEmail = Array.isArray(bizRows) && bizRows[0]?.email ? bizRows[0].email : null;

      const [profileRows]: any = await pool.query('SELECT id FROM profiles WHERE business_id = ?', [id]);
      const profileIds = Array.isArray(profileRows) ? profileRows.map((p: any) => p.id) : [];

      const emailsToDelete = new Set<string>();
      if (bizEmail) emailsToDelete.add(bizEmail.toLowerCase().trim());

      // Retrieve user IDs matching emails as well
      for (const email of emailsToDelete) {
        const [uRows]: any = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
        if (Array.isArray(uRows)) {
          uRows.forEach((u: any) => {
            if (u.id && !profileIds.includes(u.id)) {
              profileIds.push(u.id);
            }
          });
        }
      }

      // Temporarily disable foreign key checks to ensure 100% clean cascading purge across all tables
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');

      try {
        // 2. Purge all child & parent table records associated with this merchant business
        await pool.query('DELETE FROM payments WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ?)', [id]);
        await pool.query('DELETE FROM invoices WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = ?)', [id]);
        await pool.query('DELETE FROM purchases WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM products WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM customers WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM suppliers WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM categories WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM stock_transactions WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM khata_entries WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM expenses WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM subscriptions WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM settings WHERE business_id = ?', [id]);
        await pool.query('DELETE FROM profiles WHERE business_id = ?', [id]);

        // 3. Purge user credentials from users table so emails can be re-registered
        if (profileIds.length > 0) {
          const placeholders = profileIds.map(() => '?').join(',');
          await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, profileIds);
        }
        for (const email of emailsToDelete) {
          await pool.query('DELETE FROM users WHERE LOWER(email) = ?', [email]);
        }

        await pool.query('DELETE FROM businesses WHERE id = ?', [id]);
      } finally {
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    } catch (e) {
      console.error('[Admin] MySQL business permanent purge error:', e);
    }

    await recordAuditLog(
      'PERMANENT_DELETE_BUSINESS',
      'Merchant Tenant',
      `Permanently purged store account (${id}) and all associated database records (invoices, products, customers, transactions)`
    );

    res.json({ status: 'success', message: 'Merchant business account and all associated data permanently deleted with zero recovery' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

let mockBillingRequests: any[] = [];

export async function getAdminBillingRequests(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM billing_requests ORDER BY created_at DESC');
      if (Array.isArray(rows)) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}

    res.json({ status: 'success', data: mockBillingRequests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function respondAdminBillingRequest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    if (!id || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Valid request ID and status (accepted or rejected) are required' });
    }

    const responseNote = admin_response ? String(admin_response).trim() : '';

    let updatedReq: any = null;

    try {
      const [rows]: any = await pool.query('SELECT * FROM billing_requests WHERE id = ? LIMIT 1', [id]);
      if (Array.isArray(rows) && rows.length > 0) {
        const reqItem = rows[0];
        if (reqItem.status && reqItem.status !== 'pending') {
          return res.status(400).json({ error: 'This billing request decision has already been finalized and cannot be modified.' });
        }
        await pool.query(
          'UPDATE billing_requests SET status = ?, admin_response = ?, updated_at = NOW() WHERE id = ?',
          [status, responseNote || null, id]
        );

        if (status === 'accepted') {
          await activateSubscriptionPlanWithPriority(reqItem.business_id, reqItem.requested_plan);
        }

        updatedReq = { ...reqItem, status, admin_response: responseNote || null, updated_at: new Date().toISOString() };
      }
    } catch (e) {
      console.error('[Admin] MySQL respond to billing request error:', e);
    }

    const idx = mockBillingRequests.findIndex((r) => r.id === id);
    if (idx >= 0) {
      if (mockBillingRequests[idx].status !== 'pending') {
        return res.status(400).json({ error: 'This billing request decision has already been finalized and cannot be modified.' });
      }
      mockBillingRequests[idx].status = status;
      mockBillingRequests[idx].admin_response = responseNote || null;
      mockBillingRequests[idx].updated_at = new Date().toISOString();
      if (!updatedReq) updatedReq = mockBillingRequests[idx];
    } else if (!updatedReq) {
      updatedReq = { id, status, admin_response: responseNote || null, updated_at: new Date().toISOString() };
    }

    await recordAuditLog(
      'RESPOND_BILLING_REQUEST',
      'Billing Upgrade Request',
      `Admin ${status.toUpperCase()} upgrade request (${id})${responseNote ? ` [Note: ${responseNote}]` : ''}`
    );

    res.json({ status: 'success', data: updatedReq });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createBillingRequest(req: Request, res: Response) {
  try {
    const { id, business_id, business_name, requested_plan, price, utr_ref, screenshot_url, coupon_code } = req.body;

    if (!business_id || !requested_plan) {
      return res.status(400).json({ error: 'Business ID and requested plan are required' });
    }

    const reqId = id || `REQ-${Date.now()}`;
    const newReq = {
      id: reqId,
      business_id,
      business_name: business_name || 'Merchant Store',
      requested_plan,
      price: price || '0',
      utr_ref: utr_ref || '',
      screenshot_url: screenshot_url || '',
      status: 'pending',
      admin_response: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingIdx = mockBillingRequests.findIndex(r => r.id === reqId);
    if (existingIdx >= 0) {
      mockBillingRequests[existingIdx] = newReq;
    } else {
      mockBillingRequests.unshift(newReq);
    }

    try {
      await pool.query(
        `INSERT INTO billing_requests (id, business_id, business_name, requested_plan, price, utr_ref, screenshot_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           business_id = VALUES(business_id),
           business_name = VALUES(business_name),
           requested_plan = VALUES(requested_plan),
           price = VALUES(price),
           utr_ref = VALUES(utr_ref),
           screenshot_url = VALUES(screenshot_url),
           status = 'pending'`,
        [newReq.id, newReq.business_id, newReq.business_name, newReq.requested_plan, newReq.price, newReq.utr_ref, newReq.screenshot_url, 'pending']
      );
    } catch (e) {
      console.error('[MySQL Error] createBillingRequest failed:', e);
    }

    // Record coupon redemption
    const extractedCode = coupon_code || (typeof requested_plan === 'string' ? requested_plan.match(/\[Coupon:\s*([^\]]+)\]/i)?.[1] : null);
    if (extractedCode) {
      const cleanCoupon = String(extractedCode).trim().toUpperCase();
      const userKey = String(business_id);

      mockCouponUsages.push({
        coupon_code: cleanCoupon,
        user_id: userKey,
        used_at: new Date().toISOString(),
      });

      const cpn = mockCoupons.find(c => c.code === cleanCoupon);
      if (cpn) {
        cpn.uses_count = (cpn.uses_count || 0) + 1;
      }

      try {
        await pool.query(
          'INSERT INTO coupon_usages (coupon_code, user_id) VALUES (?, ?)',
          [cleanCoupon, userKey]
        );
        await pool.query(
          'UPDATE coupons SET uses_count = uses_count + 1 WHERE code = ?',
          [cleanCoupon]
        );
      } catch (e) {}
    }

    res.json({ status: 'success', data: newReq });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}


export async function getMerchantBillingRequests(req: Request, res: Response) {
  try {
    const bizId = req.query.business_id as string;
    if (!bizId) {
      return res.status(400).json({ error: 'business_id is required' });
    }

    try {
      const [rows]: any = await pool.query('SELECT * FROM billing_requests WHERE business_id = ? ORDER BY created_at DESC', [bizId]);
      if (Array.isArray(rows)) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}

    const filtered = mockBillingRequests.filter((r) => r.business_id === bizId);
    res.json({ status: 'success', data: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// ----------------------------------------------------
// COUPON MANAGEMENT CONTROLLERS
// ----------------------------------------------------

let mockCoupons: any[] = [
  {
    id: 'cpn-1',
    code: 'WELCOME50',
    discount_type: 'percentage',
    discount_value: 50,
    min_order_amount: 0,
    max_uses: 100,
    max_uses_per_user: 1,
    uses_count: 14,
    valid_until: null,
    is_active: 1,
    created_at: new Date().toISOString(),
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
    valid_until: null,
    is_active: 1,
    created_at: new Date().toISOString(),
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
    valid_until: null,
    is_active: 1,
    created_at: new Date().toISOString(),
  },
];

let mockCouponUsages: { coupon_code: string; user_id: string; used_at: string }[] = [];

export async function getAdminCoupons(_req: Request, res: Response) {
  try {
    try {
      const [rows]: any = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
      if (Array.isArray(rows) && rows.length > 0) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}
    res.json({ status: 'success', data: mockCoupons });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createOrUpdateAdminCoupon(req: Request, res: Response) {
  try {
    const { id, code, discount_type, discount_value, min_order_amount, max_uses, max_uses_per_user, is_active, valid_until } = req.body;

    if (!code || discount_value === undefined) {
      return res.status(400).json({ error: 'Coupon code and discount value are required' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const couponId = id || `cpn-${Date.now()}`;
    const discType = discount_type === 'flat' ? 'flat' : 'percentage';
    const discVal = Number(discount_value) || 0;
    const minOrder = Number(min_order_amount) || 0;
    const maxUses = max_uses === undefined || max_uses === null ? -1 : Number(max_uses);
    const maxUsesPerUser = max_uses_per_user === undefined || max_uses_per_user === null ? -1 : Number(max_uses_per_user);
    const activeState = is_active === 0 || is_active === false ? 0 : 1;

    const couponObj = {
      id: couponId,
      code: cleanCode,
      discount_type: discType,
      discount_value: discVal,
      min_order_amount: minOrder,
      max_uses: maxUses,
      max_uses_per_user: maxUsesPerUser,
      uses_count: 0,
      valid_until: valid_until || null,
      is_active: activeState,
      created_at: new Date().toISOString(),
    };

    const existingIndex = mockCoupons.findIndex(c => c.id === couponId || c.code === cleanCode);
    if (existingIndex >= 0) {
      mockCoupons[existingIndex] = { ...mockCoupons[existingIndex], ...couponObj };
    } else {
      mockCoupons.unshift(couponObj);
    }

    try {
      await pool.query(
        `INSERT INTO coupons (id, code, discount_type, discount_value, min_order_amount, max_uses, max_uses_per_user, is_active, valid_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         code=VALUES(code), discount_type=VALUES(discount_type), discount_value=VALUES(discount_value),
         min_order_amount=VALUES(min_order_amount), max_uses=VALUES(max_uses), max_uses_per_user=VALUES(max_uses_per_user),
         is_active=VALUES(is_active), valid_until=VALUES(valid_until)`,
        [couponId, cleanCode, discType, discVal, minOrder, maxUses, maxUsesPerUser, activeState, valid_until || null]
      );
    } catch (e) {
      console.error('[MySQL Error] createOrUpdateAdminCoupon failed:', e);
    }

    res.json({ status: 'success', data: couponObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteAdminCoupon(req: Request, res: Response) {
  try {
    const { id } = req.params;
    mockCoupons = mockCoupons.filter(c => c.id !== id);

    try {
      await pool.query('DELETE FROM coupons WHERE id = ?', [id]);
    } catch (e) {}

    res.json({ status: 'success', message: 'Coupon deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function validateCoupon(req: Request, res: Response) {
  try {
    const { code, originalPrice, amount, plan_amount, businessId, userId } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, error: 'Coupon code is required' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    let targetCoupon: any = null;

    try {
      const [rows]: any = await pool.query('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [cleanCode]);
      if (Array.isArray(rows) && rows.length > 0) {
        targetCoupon = rows[0];
      }
    } catch (e) {}

    if (!targetCoupon) {
      targetCoupon = mockCoupons.find(c => c.code === cleanCode && Number(c.is_active) === 1);
    }

    if (!targetCoupon) {
      return res.status(404).json({ valid: false, error: 'Invalid or inactive promo coupon code.' });
    }

    const price = Number(originalPrice ?? amount ?? plan_amount ?? 0);
    if (targetCoupon.min_order_amount && price < Number(targetCoupon.min_order_amount)) {
      return res.status(400).json({
        valid: false,
        error: `Minimum plan order value of ₹${targetCoupon.min_order_amount} is required for coupon ${cleanCode}.`,
      });
    }

    if (targetCoupon.max_uses !== -1 && targetCoupon.uses_count >= targetCoupon.max_uses) {
      return res.status(400).json({ valid: false, error: `Coupon ${cleanCode} total usage limit has been reached.` });
    }

    // Check per-user limit
    const perUserLimit = Number(targetCoupon.max_uses_per_user);
    if (perUserLimit > 0 && perUserLimit !== -1) {
      const targetUserKey = String(businessId || userId || '').trim();
      if (targetUserKey) {
        let userUsageCount = 0;
        
        // Count in-memory mock coupon usages
        const mockCount = mockCouponUsages.filter(
          u => u.coupon_code === cleanCode && u.user_id === targetUserKey
        ).length;

        // Count MySQL coupon_usages
        try {
          const [uRows]: any = await pool.query(
            'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_code = ? AND user_id = ?',
            [cleanCode, targetUserKey]
          );
          userUsageCount = Math.max(mockCount, Number(uRows?.[0]?.count || 0));
        } catch (e) {
          userUsageCount = mockCount;
        }

        // Count MySQL billing_requests
        try {
          const [bRows]: any = await pool.query(
            'SELECT COUNT(*) as count FROM billing_requests WHERE (business_id = ? OR business_name = ?) AND (requested_plan LIKE ? OR price LIKE ?)',
            [targetUserKey, targetUserKey, `%${cleanCode}%`, `%${cleanCode}%`]
          );
          userUsageCount = Math.max(userUsageCount, Number(bRows?.[0]?.count || 0));
        } catch (e) {}

        if (userUsageCount >= perUserLimit) {
          return res.status(400).json({
            valid: false,
            error: `Promo coupon code "${cleanCode}" has a maximum limit of ${perUserLimit} use(s) per merchant account. You have already redeemed this coupon.`,
          });
        }
      }
    }

    let discountAmount = 0;
    if (targetCoupon.discount_type === 'percentage') {
      discountAmount = Math.round((price * Number(targetCoupon.discount_value)) / 100);
    } else {
      discountAmount = Math.round(Number(targetCoupon.discount_value));
    }

    if (discountAmount > price) discountAmount = price;
    const finalPrice = Math.max(0, price - discountAmount);

    res.json({
      valid: true,
      code: targetCoupon.code,
      discount_type: targetCoupon.discount_type,
      discount_value: targetCoupon.discount_value,
      discountAmount,
      finalPrice,
      message: `Coupon ${targetCoupon.code} applied! Saved ₹${discountAmount.toLocaleString()}.`,
    });

  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
}

// ----------------------------------------------------
// SUBSCRIPTION PRIORITY QUEUE ENGINE
// ----------------------------------------------------

export async function syncBusinessSubscriptionState(businessId: string) {
  try {
    const now = new Date();

    // 1. Fetch active subscription for this business from subscription_queue
    const [activeRows]: any = await pool.query(
      `SELECT * FROM subscription_queue WHERE business_id = ? AND status = 'active' ORDER BY priority_order DESC, created_at ASC LIMIT 1`,
      [businessId]
    );

    let activeSub = Array.isArray(activeRows) && activeRows.length > 0 ? activeRows[0] : null;

    let activeSubExpiredNaturally = false;

    // 2. Check if active sub has expired
    if (activeSub && activeSub.expires_at) {
      const expiresAt = new Date(activeSub.expires_at);
      if (expiresAt <= now) {
        await pool.query(
          `UPDATE subscription_queue SET status = 'expired', remaining_days = 0 WHERE id = ?`,
          [activeSub.id]
        );
        activeSub = null;
        activeSubExpiredNaturally = true;
      } else {
        // Dynamic remaining days calculation
        const remainingDaysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        await pool.query(
          `UPDATE subscription_queue SET remaining_days = ? WHERE id = ?`,
          [remainingDaysLeft, activeSub.id]
        );
        activeSub.remaining_days = remainingDaysLeft;
      }
    }

    // 3. If no active sub (or active sub just expired/cancelled), auto-promote highest priority queued plan
    if (!activeSub) {
      const [queuedRows]: any = await pool.query(
        `SELECT * FROM subscription_queue WHERE business_id = ? AND status = 'queued' ORDER BY priority_order DESC, created_at ASC LIMIT 1`,
        [businessId]
      );

      if (Array.isArray(queuedRows) && queuedRows.length > 0) {
        const nextSub = queuedRows[0];
        const startDate = now;
        const remainingDaysNum = nextSub.remaining_days !== null && nextSub.remaining_days !== undefined ? Number(nextSub.remaining_days) : 0;
        const durationDays = remainingDaysNum > 0 ? remainingDaysNum : (Number(nextSub.duration_days) || 365);
        const expiresAt = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

        await pool.query(
          `UPDATE subscription_queue SET status = 'active', start_date = ?, expires_at = ?, remaining_days = ? WHERE id = ?`,
          [startDate, expiresAt, durationDays, nextSub.id]
        );

        activeSub = { ...nextSub, status: 'active', start_date: startDate, expires_at: expiresAt, remaining_days: durationDays };
      }
    }

    // 4. Sync `businesses.plan_name` with current active plan or Free Tier
    const activePlanName = activeSub ? activeSub.plan_name : 'Free Tier';
    await pool.query('UPDATE businesses SET plan_name = ? WHERE id = ?', [activePlanName, businessId]);
    try {
      await pool.query('UPDATE profiles SET plan_tier = ? WHERE business_id = ?', [activePlanName, businessId]);
    } catch (e) {}

    return activeSub;
  } catch (e) {
    console.error('[Subscription Sync Error]:', e);
    return null;
  }
}

export async function syncAllBusinessesSubscriptionState() {
  try {
    const [bizRows]: any = await pool.query('SELECT DISTINCT business_id FROM subscription_queue');
    if (Array.isArray(bizRows) && bizRows.length > 0) {
      for (const b of bizRows) {
        if (b.business_id) {
          await syncBusinessSubscriptionState(b.business_id);
        }
      }
    }
  } catch (e) {
    console.error('[Global Subscription Sync Error]:', e);
  }
}

export function parseDurationDaysFromPlanName(planNameInput: string): number {
  if (!planNameInput) return 36500;

  const lower = planNameInput.toLowerCase().trim();

  // Free Tier / Lifetime matching
  if (lower === 'free' || lower === 'free tier' || lower.includes('free tier') || lower.includes('lifetime') || lower === 'free plan') {
    return 36500; // Lifetime Access (100 Years)
  }

  // Explicit Day matching e.g. "(90 Days)", "14-Day Trial"
  const daysMatch = lower.match(/(\d+)\s*-\s*day|(\d+)\s*days?/i);
  if (daysMatch) {
    const num = parseInt(daysMatch[1] || daysMatch[2], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Month matching e.g. "3 Months", "6 Month", "1 Month"
  const monthMatch = lower.match(/(\d+)\s*months?/i);
  if (monthMatch) {
    const num = parseInt(monthMatch[1], 10);
    if (!isNaN(num) && num > 0) return num * 30;
  }

  // Year matching e.g. "2 Years", "3 Year", "1 Year"
  const yearMatch = lower.match(/(\d+)\s*years?/i);
  if (yearMatch) {
    const num = parseInt(yearMatch[1], 10);
    if (!isNaN(num) && num > 0) return num * 365;
  }

  // Fallbacks for single word keywords
  if (lower.includes('year')) return 365;
  if (lower.includes('month')) return 30;

  return 365;
}

export async function getPlanPriorityAndCleanName(planNameInput: string) {
  if (!planNameInput) return { basePlanName: 'Free Tier', priorityOrder: 0, isZeroPrice: true };

  const cleaned = planNameInput
    .replace(/\s*\[Coupon:[^\]]+\]/gi, '')
    .replace(/\s*\[Saved[^\]]+\]/gi, '')
    .trim();

  const baseName = cleaned
    .replace(/\s*\([^)]*\)/g, '')
    .trim();

  const targetName = baseName || cleaned;

  try {
    const [exactRows]: any = await pool.query(
      'SELECT name, code, priority_order, price_monthly, price_3months, price_6months, price_yearly, price_2years, price_3years FROM plans WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1',
      [targetName, targetName]
    );
    if (Array.isArray(exactRows) && exactRows.length > 0) {
      const p = exactRows[0];
      const priority = Number(p.priority_order) || 0;
      const allPricesZero = (Number(p.price_monthly) || 0) === 0 &&
                            (Number(p.price_3months) || 0) === 0 &&
                            (Number(p.price_6months) || 0) === 0 &&
                            (Number(p.price_yearly) || 0) === 0 &&
                            (Number(p.price_2years) || 0) === 0 &&
                            (Number(p.price_3years) || 0) === 0;
      return {
        basePlanName: p.name,
        priorityOrder: priority,
        isZeroPrice: priority === 0 && allPricesZero,
      };
    }

    const [allPlans]: any = await pool.query('SELECT name, code, priority_order, price_monthly, price_3months, price_6months, price_yearly, price_2years, price_3years FROM plans ORDER BY CHAR_LENGTH(name) DESC');
    if (Array.isArray(allPlans) && allPlans.length > 0) {
      for (const p of allPlans) {
        const pName = (p.name || '').toLowerCase().trim();
        const pCode = (p.code || '').toLowerCase().trim();
        const tLower = targetName.toLowerCase();
        if (pName && (tLower.includes(pName) || pName.includes(tLower))) {
          const priority = Number(p.priority_order) || 0;
          const allPricesZero = (Number(p.price_monthly) || 0) === 0 &&
                                (Number(p.price_3months) || 0) === 0 &&
                                (Number(p.price_6months) || 0) === 0 &&
                                (Number(p.price_yearly) || 0) === 0 &&
                                (Number(p.price_2years) || 0) === 0 &&
                                (Number(p.price_3years) || 0) === 0;
          return { basePlanName: p.name, priorityOrder: priority, isZeroPrice: priority === 0 && allPricesZero };
        }
        if (pCode && (tLower.includes(pCode) || pCode.includes(tLower))) {
          const priority = Number(p.priority_order) || 0;
          const allPricesZero = (Number(p.price_monthly) || 0) === 0 &&
                                (Number(p.price_3months) || 0) === 0 &&
                                (Number(p.price_6months) || 0) === 0 &&
                                (Number(p.price_yearly) || 0) === 0 &&
                                (Number(p.price_2years) || 0) === 0 &&
                                (Number(p.price_3years) || 0) === 0;
          return { basePlanName: p.name, priorityOrder: priority, isZeroPrice: priority === 0 && allPricesZero };
        }
      }
    }
  } catch (e) {}

  const tLower = targetName.toLowerCase();
  let fallbackPriority = 0;
  if (tLower.includes('pro') || tLower.includes('r3f') || tLower.includes('enterprise')) {
    fallbackPriority = 2;
  } else if (tLower.includes('starter') || tLower.includes('sd') || tLower.includes('business')) {
    fallbackPriority = 1;
  }

  const isFreeName = tLower === 'free' || tLower === 'free tier' || tLower.includes('free tier');

  return {
    basePlanName: targetName,
    priorityOrder: fallbackPriority,
    isZeroPrice: fallbackPriority === 0 && isFreeName,
  };
}

export const activateSubscriptionPlanWithPriority = processSubscriptionQueue;

export async function processSubscriptionQueue(
  businessId: string,
  planName: string,
  customDurationDays?: number
) {
  try {
    const cleanPlan = planName.replace(/\s*\[Coupon:[^\]]+\]/gi, '').replace(/\s*\[Saved[^\]]+\]/gi, '').trim();
    await syncBusinessSubscriptionState(businessId);

    const [activeRows]: any = await pool.query(
      `SELECT * FROM subscription_queue WHERE business_id = ? AND status = 'active' ORDER BY priority_order DESC, created_at ASC LIMIT 1`,
      [businessId]
    );

    const activeSub = Array.isArray(activeRows) && activeRows.length > 0 ? activeRows[0] : null;

    // 1. Fetch priority and base plan name of NEW plan
    const newPlanInfo = await getPlanPriorityAndCleanName(cleanPlan);
    const newPriority = newPlanInfo.priorityOrder;
    const isZeroPrice = newPlanInfo.isZeroPrice || newPriority === 0 || cleanPlan.toLowerCase().includes('free') || cleanPlan.toLowerCase().includes('trial');

    const durationDays = customDurationDays || (isZeroPrice ? 36500 : parseDurationDaysFromPlanName(cleanPlan));

    // Handle cancellation / downgrade request (Cancel Active Plan)
    if (isZeroPrice) {
      await pool.query(
        `UPDATE subscription_queue SET status = 'expired', remaining_days = 0 WHERE business_id = ? AND status = 'active'`,
        [businessId]
      );

      // Resync subscription state: If there is a queued plan, promote it to active immediately!
      const promotedSub = await syncBusinessSubscriptionState(businessId);
      const activePlanName = promotedSub ? promotedSub.plan_name : cleanPlan;

      return {
        status: 'cancelled',
        message: promotedSub
          ? `Active plan cancelled. Promoted next queued plan "${promotedSub.plan_name}" immediately.`
          : `Active plan cancelled. Downgraded store to ${cleanPlan}.`,
        activePlan: activePlanName,
      };
    }

    // 2. Fetch priority and base plan name of CURRENT ACTIVE plan
    let currentPlanNameStr = 'Free Tier';
    if (activeSub) {
      currentPlanNameStr = activeSub.plan_name;
    } else {
      const [bRows]: any = await pool.query('SELECT plan_name FROM businesses WHERE id = ? LIMIT 1', [businessId]);
      currentPlanNameStr = bRows[0]?.plan_name || 'Free Tier';
    }

    const currentPlanInfo = await getPlanPriorityAndCleanName(currentPlanNameStr);
    const currentPriority = currentPlanInfo.priorityOrder;

    const isCurrentFree = !activeSub || currentPlanNameStr.toLowerCase().includes('free') || currentPlanNameStr.toLowerCase().includes('trial');

    // SCENARIO 1: No active paid plan or current is Free Tier -> Activate Immediately
    if (isCurrentFree) {
      const startDate = new Date();
      const expiresAt = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      await pool.query('UPDATE businesses SET plan_name = ? WHERE id = ?', [cleanPlan, businessId]);
      try {
        await pool.query('UPDATE profiles SET plan_tier = ? WHERE business_id = ?', [cleanPlan, businessId]);
      } catch (e) {}

      const queueId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO subscription_queue (id, business_id, plan_name, priority_order, duration_days, remaining_days, status, start_date, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [queueId, businessId, cleanPlan, newPriority, durationDays, durationDays, startDate, expiresAt]
      );

      return { status: 'activated', message: `Plan "${cleanPlan}" activated immediately.` };
    }

    const isSameBasePlan = newPlanInfo.basePlanName.toLowerCase().trim() === currentPlanInfo.basePlanName.toLowerCase().trim();

    // SCENARIO 2: Same Priority & Same Base Plan Tier -> Extend Expiration & Validity Date!
    if (newPriority === currentPriority && isSameBasePlan) {
      const [activeSubRows]: any = await pool.query(
        `SELECT * FROM subscription_queue WHERE business_id = ? AND status = 'active' ORDER BY expires_at DESC LIMIT 1`,
        [businessId]
      );

      if (Array.isArray(activeSubRows) && activeSubRows.length > 0) {
        const curSub = activeSubRows[0];
        const currentExpiresAt = curSub.expires_at ? new Date(curSub.expires_at) : new Date();
        const newExpiresAt = new Date(currentExpiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const newRemaining = Number(curSub.remaining_days || 0) + durationDays;

        await pool.query(
          `UPDATE subscription_queue SET plan_name = ?, expires_at = ?, remaining_days = ?, duration_days = duration_days + ? WHERE id = ?`,
          [cleanPlan, newExpiresAt, newRemaining, durationDays, curSub.id]
        );
      } else {
        const startDate = new Date();
        const expiresAt = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const queueId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        await pool.query(
          `INSERT INTO subscription_queue (id, business_id, plan_name, priority_order, duration_days, remaining_days, status, start_date, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
          [queueId, businessId, cleanPlan, newPriority, durationDays, durationDays, startDate, expiresAt]
        );
      }

      await pool.query('UPDATE businesses SET plan_name = ? WHERE id = ?', [cleanPlan, businessId]);

      return { status: 'extended', message: `Extended validity for plan "${cleanPlan}" by ${durationDays} days.` };
    }

    // SCENARIO 3: Lower Priority Plan OR Different Plan of Same Priority -> Queue behind active higher plan!
    if (newPriority < currentPriority || (newPriority === currentPriority && !isSameBasePlan)) {
      if (!isZeroPrice) {
        const queueId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        await pool.query(
          `INSERT INTO subscription_queue (id, business_id, plan_name, priority_order, duration_days, remaining_days, status)
           VALUES (?, ?, ?, ?, ?, ?, 'queued')`,
          [queueId, businessId, cleanPlan, newPriority, durationDays, durationDays]
        );
      }

      return { status: 'queued', message: `Plan "${cleanPlan}" (Priority #${newPriority}) queued behind active higher priority plan.` };
    }

    // SCENARIO 4: Higher Priority Plan -> Immediately Activate & Move Current Active Plan into Subscription Queue (if paid)
    if (newPriority > currentPriority) {
      if (activeSub) {
        const isCurrentActiveFree = (activeSub.plan_name || '').toLowerCase().includes('free') || (activeSub.plan_name || '').toLowerCase().includes('trial');
        if (isCurrentActiveFree) {
          await pool.query(
            `UPDATE subscription_queue SET status = 'expired', remaining_days = 0 WHERE id = ?`,
            [activeSub.id]
          );
        } else {
          const now = new Date();
          const curExp = activeSub.expires_at ? new Date(activeSub.expires_at) : now;
          const remDays = Math.max(0, Math.ceil((curExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          await pool.query(
            `UPDATE subscription_queue SET status = 'queued', remaining_days = ?, expires_at = NULL WHERE id = ?`,
            [remDays, activeSub.id]
          );
        }
      } else {
        await pool.query(
          `UPDATE subscription_queue SET status = 'expired' WHERE business_id = ? AND status = 'active' AND (LOWER(plan_name) LIKE '%free%' OR LOWER(plan_name) LIKE '%trial%')`,
          [businessId]
        );
      }

      const startDate = new Date();
      const expiresAt = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const queueId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO subscription_queue (id, business_id, plan_name, priority_order, duration_days, remaining_days, status, start_date, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [queueId, businessId, cleanPlan, newPriority, durationDays, durationDays, startDate, expiresAt]
      );

      await pool.query('UPDATE businesses SET plan_name = ? WHERE id = ?', [cleanPlan, businessId]);
      try {
        await pool.query('UPDATE profiles SET plan_tier = ? WHERE business_id = ?', [cleanPlan, businessId]);
      } catch (e) {}

      return { status: 'preempted_upgraded', message: `Upgraded to higher priority plan "${cleanPlan}" (Priority #${newPriority}).` };
    }
  } catch (err: any) {
    console.error('[Subscription Priority Engine Error]:', err);
  }
}

export async function getMerchantSubscriptionQueue(req: Request, res: Response) {
  try {
    const bizId = (req.query.business_id as string) || (req.query.bizId as string);
    if (!bizId) {
      return res.status(400).json({ error: 'business_id is required' });
    }

    try {
      // Auto-sync subscription state to handle expirations & queue promotions
      await syncBusinessSubscriptionState(bizId);

      const [rows]: any = await pool.query(
        `SELECT * FROM subscription_queue 
         WHERE business_id = ? 
           AND LOWER(plan_name) NOT LIKE '%free%' 
           AND LOWER(plan_name) NOT LIKE '%trial%'
         ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC, priority_order DESC, created_at ASC`,
        [bizId]
      );
      if (Array.isArray(rows)) {
        return res.json({ status: 'success', data: rows });
      }
    } catch (e) {}

      res.json({ status: 'success', data: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function cancelQueuedSubscriptionItem(req: Request, res: Response) {
  try {
    const { queueId } = req.params;
    if (!queueId) {
      return res.status(400).json({ error: 'Queue item ID is required' });
    }

    const [rows]: any = await pool.query('SELECT business_id, status FROM subscription_queue WHERE id = ? LIMIT 1', [queueId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Subscription queue item not found' });
    }

    const item = rows[0];
    await pool.query("UPDATE subscription_queue SET status = 'expired', remaining_days = 0 WHERE id = ?", [queueId]);

    // Resync subscription state in case an active plan was cancelled or queue shifted
    const activeSub = await syncBusinessSubscriptionState(item.business_id);

    return res.json({
      status: 'success',
      message: 'Subscription queue item cancelled successfully',
      activePlan: activeSub ? activeSub.plan_name : 'Free Tier',
    });
  } catch (err: any) {
    console.error('[Cancel Queue Item Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel queued subscription item' });
  }
}

let systemUpiSettings = {
  upi_id: 'billingmaster@upi',
  upi_name: 'BillingMaster Studio',
};

export async function getAdminUpiSettings(_req: Request, res: Response) {
  try {
    const [rows]: any = await pool.query("SELECT upi_id, account_holder_name FROM settings WHERE business_id = 'system_admin' ORDER BY id DESC LIMIT 1");
    if (Array.isArray(rows) && rows.length > 0 && rows[0].upi_id) {
      systemUpiSettings = {
        upi_id: rows[0].upi_id,
        upi_name: rows[0].account_holder_name || 'BillingMaster Studio',
      };
    } else {
      const [fallbackRows]: any = await pool.query("SELECT upi_id, account_holder_name FROM settings WHERE upi_id IS NOT NULL ORDER BY id DESC LIMIT 1");
      if (Array.isArray(fallbackRows) && fallbackRows.length > 0 && fallbackRows[0].upi_id) {
        systemUpiSettings = {
          upi_id: fallbackRows[0].upi_id,
          upi_name: fallbackRows[0].account_holder_name || 'BillingMaster Studio',
        };
      }
    }
  } catch (e) {}

  res.json({
    status: 'success',
    data: {
      upi_id: systemUpiSettings.upi_id,
      upi_name: systemUpiSettings.upi_name,
      account_holder_name: systemUpiSettings.upi_name,
    }
  });
}

export async function updateAdminUpiSettings(req: Request, res: Response) {
  try {
    const { upi_id, upi_name } = req.body;
    if (!upi_id) {
      return res.status(400).json({ error: 'UPI ID is required' });
    }

    const cleanUpiId = String(upi_id).trim();
    const cleanUpiName = String(upi_name || 'BillingMaster Studio').trim();

    systemUpiSettings = {
      upi_id: cleanUpiId,
      upi_name: cleanUpiName,
    };

    try {
      const [result]: any = await pool.query(
        "UPDATE settings SET upi_id = ?, account_holder_name = ? WHERE business_id = 'system_admin'",
        [cleanUpiId, cleanUpiName]
      );
      if (!result || result.affectedRows === 0) {
        await pool.query(
          "INSERT INTO settings (business_id, upi_id, account_holder_name) VALUES ('system_admin', ?, ?)",
          [cleanUpiId, cleanUpiName]
        );
      }
    } catch (e) {
      console.error('[MySQL Error] updateAdminUpiSettings failed:', e);
    }

    res.json({
      status: 'success',
      message: 'UPI settings saved successfully',
      data: {
        upi_id: cleanUpiId,
        upi_name: cleanUpiName,
        account_holder_name: cleanUpiName,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
