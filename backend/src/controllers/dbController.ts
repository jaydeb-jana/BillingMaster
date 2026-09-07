import { Response } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/mysql.js';
import { AuthRequest } from '../middleware/auth.js';

const ALLOWED_TABLES = new Set([
  'businesses',
  'profiles',
  'settings',
  'categories',
  'customers',
  'products',
  'suppliers',
  'invoices',
  'invoice_items',
  'payments',
  'purchases',
  'purchase_items',
  'stock_transactions',
  'expenses',
  'khata_entries',
  'returns',
  'billing_requests',
  'coupons',
  'coupon_usages',
  'subscription_queue',
]);

const GLOBAL_TABLES = new Set(['businesses', 'profiles', 'settings', 'invoice_items', 'purchase_items']);

export async function listRecords(req: AuthRequest, res: Response) {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  try {
    const query = req.query;
    const whereConditions: string[] = [];
    const values: any[] = [];

    // Filter by business_id if present in query or user context
    if (!GLOBAL_TABLES.has(table)) {
      if (query.business_id) {
        whereConditions.push('business_id = ?');
        values.push(query.business_id);
      } else if (req.user?.business_id) {
        whereConditions.push('business_id = ?');
        values.push(req.user.business_id);
      }
    }

    // Process search & other query parameters
    const searchVal = String(query.search || query.q || '').trim();
    if (searchVal) {
      const pattern = `%${searchVal}%`;
      if (table === 'products') {
        whereConditions.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR description LIKE ?)');
        values.push(pattern, pattern, pattern, pattern);
      } else if (table === 'customers') {
        whereConditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?)');
        values.push(pattern, pattern, pattern, pattern);
      } else if (table === 'invoices') {
        whereConditions.push('(invoice_number LIKE ? OR status LIKE ? OR payment_method LIKE ?)');
        values.push(pattern, pattern, pattern);
      }
    }

    Object.entries(query).forEach(([key, val]) => {
      if (key === 'order' || key === 'limit' || key === 'offset' || key === 'business_id' || key === 'search' || key === 'q') return;
      const strVal = String(val);
      if (strVal.startsWith('eq.')) {
        whereConditions.push(`\`${key}\` = ?`);
        values.push(strVal.slice(3));
      } else {
        whereConditions.push(`\`${key}\` = ?`);
        values.push(val);
      }
    });

    let countSql = `SELECT COUNT(*) AS total FROM \`${table}\``;
    if (whereConditions.length > 0) {
      countSql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    const [countRows]: any = await pool.query(countSql, values);
    const totalCount = Array.isArray(countRows) && countRows.length > 0 ? Number(countRows[0].total || 0) : 0;

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');

    let sql = `SELECT * FROM \`${table}\``;
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    if (query.order) {
      const [col, dir] = String(query.order).split('.');
      const direction = dir && dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY \`${col}\` ${direction}`;
    } else if (table === 'invoices') {
      sql += ` ORDER BY created_at DESC`;
    }

    const limitNum = query.limit !== undefined ? Math.min(1000, Math.max(1, Number(query.limit))) : (query.offset !== undefined ? 50 : 200);
    const offsetNum = query.offset !== undefined ? Math.max(0, Number(query.offset)) : 0;
    sql += ` LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const [rows]: any = await pool.query(sql, values);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err: any) {
    console.error(`Error listing table ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to query table ${table}` });
  }
}

function formatValueForMysql(val: any): any {
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
  }
  return val;
}

function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(payload)) {
    sanitized[key] = formatValueForMysql(val);
  }
  return sanitized;
}

const tableColumnsCache = new Map<string, Set<string>>();

async function getTableColumns(table: string): Promise<Set<string>> {
  if (tableColumnsCache.has(table)) {
    return tableColumnsCache.get(table)!;
  }
  try {
    const [rows]: any = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    if (Array.isArray(rows) && rows.length > 0) {
      const colSet = new Set<string>(rows.map((r: any) => r.Field));
      tableColumnsCache.set(table, colSet);
      return colSet;
    }
  } catch (err) {
    console.error(`Error fetching columns for table ${table}:`, err);
  }
  return new Set<string>();
}

async function filterPayloadForTable(table: string, payload: Record<string, any>): Promise<Record<string, any>> {
  const sanitized = sanitizePayload(payload);
  const validCols = await getTableColumns(table);
  if (validCols.size === 0) return sanitized;

  const filtered: Record<string, any> = {};
  for (const [key, val] of Object.entries(sanitized)) {
    if (validCols.has(key)) {
      filtered[key] = val;
    }
  }
  return filtered;
}

export async function insertRecord(req: AuthRequest, res: Response) {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  const rawPayload = sanitizePayload(req.body);

  if (!rawPayload.business_id && !GLOBAL_TABLES.has(table) && req.user?.business_id) {
    rawPayload.business_id = req.user.business_id;
  }

  if (!rawPayload.id) {
    rawPayload.id = crypto.randomUUID();
  }

  // Ensure unique internal SKU for products if empty
  if (table === 'products' && (!rawPayload.sku || !String(rawPayload.sku).trim())) {
    const cleanId = String(rawPayload.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    rawPayload.sku = `AUTOSKU-${(cleanId || Date.now().toString(36)).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Duplicate phone check for customers
  if (table === 'customers' && rawPayload.phone && rawPayload.business_id) {
    const cleanPhone = String(rawPayload.phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const [existing]: any = await pool.query(
        `SELECT id, name FROM customers WHERE business_id = ? AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ? LIMIT 1`,
        [rawPayload.business_id, `%${cleanPhone}`]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        res.status(400).json({ error: `A customer with phone number (${rawPayload.phone}) already exists ("${existing[0].name}")` });
        return;
      }
    }
  }

  // Duplicate catalog handle check for businesses
  if (table === 'businesses') {
    const targetId = String(rawPayload.id || '');
    const targetHandle = String(rawPayload.catalog_slug || rawPayload.catalog_handle || '').trim().toLowerCase();
    const conflictStore = await validateOrGenerateCatalogHandle(rawPayload, targetId);
    if (conflictStore && targetHandle) {
      res.status(400).json({ error: `The catalog handle "${targetHandle}" is already taken by another store ("${conflictStore}").` });
      return;
    }
  }

  const payload = await filterPayloadForTable(table, rawPayload);
  const keys = Object.keys(payload);
  const values = Object.values(payload);

  if (keys.length === 0) {
    res.status(400).json({ error: 'Payload body is empty' });
    return;
  }

  const columns = keys.map((k) => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;

  try {
    await pool.query(sql, values);
    const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [rawPayload.id]);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : rawPayload;
    res.json(created);
  } catch (err: any) {
    console.error(`Error inserting into ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to insert into ${table}` });
  }
}

async function validateOrGenerateCatalogHandle(rawPayload: any, targetId: string): Promise<string | null> {
  const targetHandle = String(rawPayload.catalog_slug || rawPayload.catalog_handle || '').trim().toLowerCase();
  if (targetHandle) {
    const [existing]: any = await pool.query(
      `SELECT id, name FROM businesses WHERE id != ? AND (
        LOWER(catalog_slug) = ? OR 
        LOWER(catalog_handle) = ?
      ) LIMIT 1`,
      [targetId || '', targetHandle, targetHandle]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return existing[0].name;
    }
    rawPayload.catalog_slug = targetHandle;
    rawPayload.catalog_handle = targetHandle;
  } else if (rawPayload.name || targetId) {
    const baseName = String(rawPayload.name || 'store').toLowerCase();
    let clean = baseName.replace(/[^a-z0-9_-]/g, '').trim();
    if (clean.length < 3) {
      const shortId = String(targetId || rawPayload.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase();
      clean = `store-${shortId}`;
    }
    let finalSlug = clean;
    let counter = 1;
    while (true) {
      const [dup]: any = await pool.query(
        `SELECT id FROM businesses WHERE id != ? AND (LOWER(catalog_slug) = ? OR LOWER(catalog_handle) = ?) LIMIT 1`,
        [targetId || '', finalSlug, finalSlug]
      );
      if (!Array.isArray(dup) || dup.length === 0) break;
      finalSlug = `${clean}-${counter++}`;
    }
    rawPayload.catalog_slug = finalSlug;
    rawPayload.catalog_handle = finalSlug;
  }
  return null;
}

export async function upsertRecord(req: AuthRequest, res: Response) {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  const rawPayload = sanitizePayload(req.body);

  if (!rawPayload.business_id && !GLOBAL_TABLES.has(table) && req.user?.business_id) {
    rawPayload.business_id = req.user.business_id;
  }

  if (!rawPayload.id) {
    rawPayload.id = crypto.randomUUID();
  }

  // Ensure unique internal SKU for products if empty
  if (table === 'products' && (!rawPayload.sku || !String(rawPayload.sku).trim())) {
    const cleanId = String(rawPayload.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    rawPayload.sku = `AUTOSKU-${(cleanId || Date.now().toString(36)).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Duplicate catalog handle check for businesses on upsert
  if (table === 'businesses') {
    const targetId = String(rawPayload.id || '');
    const targetHandle = String(rawPayload.catalog_slug || rawPayload.catalog_handle || '').trim().toLowerCase();
    const conflictStore = await validateOrGenerateCatalogHandle(rawPayload, targetId);
    if (conflictStore && targetHandle) {
      res.status(400).json({ error: `The catalog handle "${targetHandle}" is already taken by another store ("${conflictStore}").` });
      return;
    }
  }

  const payload = await filterPayloadForTable(table, rawPayload);
  const keys = Object.keys(payload);
  const values = Object.values(payload);

  const columns = keys.map((k) => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const updateClauses = keys.map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

  const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;

  try {
    await pool.query(sql, values);
    const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [rawPayload.id]);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : rawPayload;
    res.json(created);
  } catch (err: any) {
    console.error(`Error upserting ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to upsert ${table}` });
  }
}

export async function updateRecord(req: AuthRequest, res: Response) {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  const rawPayload = sanitizePayload(req.body);
  delete rawPayload.id;

  // Protect recorded date and time on khata_entries from being altered
  if (table === 'khata_entries') {
    delete rawPayload.date;
    delete rawPayload.time;
  }

  // Duplicate phone check for customers on update
  if (table === 'customers' && rawPayload.phone) {
    const cleanPhone = String(rawPayload.phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const [existing]: any = await pool.query(
        `SELECT id, name FROM customers WHERE id != ? AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ? LIMIT 1`,
        [id, `%${cleanPhone}`]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        res.status(400).json({ error: `A customer with phone number (${rawPayload.phone}) already exists ("${existing[0].name}")` });
        return;
      }
    }
  }

  // Duplicate catalog handle check for businesses on update
  if (table === 'businesses') {
    const targetHandle = String(rawPayload.catalog_slug || rawPayload.catalog_handle || '').trim().toLowerCase();
    const conflictStore = await validateOrGenerateCatalogHandle(rawPayload, id);
    if (conflictStore && targetHandle) {
      res.status(400).json({ error: `The catalog handle "${targetHandle}" is already taken by another store ("${conflictStore}").` });
      return;
    }
  }

  const payload = await filterPayloadForTable(table, rawPayload);
  const keys = Object.keys(payload);
  if (keys.length === 0) {
    res.json({ id });
    return;
  }

  const setClauses = keys.map((k) => `\`${k}\` = ?`).join(', ');
  const values = [...Object.values(payload), id];
  const sql = `UPDATE \`${table}\` SET ${setClauses} WHERE id = ?`;

  try {
    await pool.query(sql, values);
    const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [id]);
    const updated = Array.isArray(rows) && rows.length > 0 ? rows[0] : { id, ...rawPayload };
    res.json(updated);
  } catch (err: any) {
    console.error(`Error updating ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to update ${table}` });
  }
}

export async function removeRecord(req: AuthRequest, res: Response) {
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  try {
    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    res.json({ success: true, id });
  } catch (err: any) {
    console.error(`Error deleting from ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to delete from ${table}` });
  }
}
