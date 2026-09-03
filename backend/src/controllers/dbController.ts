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

    // Filter by business_id if present in user context or query
    if (!GLOBAL_TABLES.has(table)) {
      if (req.user?.business_id) {
        whereConditions.push('business_id = ?');
        values.push(req.user.business_id);
      } else if (query.business_id) {
        whereConditions.push('business_id = ?');
        values.push(query.business_id);
      }
    }

    // Process other query parameters
    Object.entries(query).forEach(([key, val]) => {
      if (key === 'order' || key === 'limit' || key === 'business_id') return;
      const strVal = String(val);
      if (strVal.startsWith('eq.')) {
        whereConditions.push(`\`${key}\` = ?`);
        values.push(strVal.slice(3));
      } else {
        whereConditions.push(`\`${key}\` = ?`);
        values.push(val);
      }
    });

    let sql = `SELECT * FROM \`${table}\``;
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    if (query.order) {
      const [col, dir] = String(query.order).split('.');
      const direction = dir && dir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY \`${col}\` ${direction}`;
    }

    if (query.limit) {
      const limitNum = Number(query.limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        sql += ` LIMIT ${limitNum}`;
      }
    }

    const [rows]: any = await pool.query(sql, values);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err: any) {
    console.error(`Error listing table ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to query table ${table}` });
  }
}

export async function insertRecord(req: AuthRequest, res: Response) {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  const payload = { ...req.body };

  if (!payload.business_id && !GLOBAL_TABLES.has(table) && req.user?.business_id) {
    payload.business_id = req.user.business_id;
  }

  if (!payload.id) {
    payload.id = crypto.randomUUID();
  }

  // Duplicate phone check for customers
  if (table === 'customers' && payload.phone && payload.business_id) {
    const cleanPhone = String(payload.phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const [existing]: any = await pool.query(
        `SELECT id, name FROM customers WHERE business_id = ? AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ? LIMIT 1`,
        [payload.business_id, `%${cleanPhone}`]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        res.status(400).json({ error: `A customer with phone number (${payload.phone}) already exists ("${existing[0].name}")` });
        return;
      }
    }
  }

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
    const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [payload.id]);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload;
    res.json(created);
  } catch (err: any) {
    console.error(`Error inserting into ${table}:`, err);
    res.status(500).json({ error: err.message || `Failed to insert into ${table}` });
  }
}

export async function upsertRecord(req: AuthRequest, res: Response) {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: `Table '${table}' is not supported` });
    return;
  }

  const payload = { ...req.body };

  if (!payload.business_id && !GLOBAL_TABLES.has(table) && req.user?.business_id) {
    payload.business_id = req.user.business_id;
  }

  if (!payload.id) {
    payload.id = crypto.randomUUID();
  }

  const keys = Object.keys(payload);
  const values = Object.values(payload);

  const columns = keys.map((k) => `\`${k}\``).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const updateClauses = keys.map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

  const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;

  try {
    await pool.query(sql, values);
    const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ? LIMIT 1`, [payload.id]);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload;
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

  const payload = { ...req.body };
  delete payload.id;

  // Duplicate phone check for customers on update
  if (table === 'customers' && payload.phone) {
    const cleanPhone = String(payload.phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const [existing]: any = await pool.query(
        `SELECT id, name FROM customers WHERE id != ? AND REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ? LIMIT 1`,
        [id, `%${cleanPhone}`]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        res.status(400).json({ error: `A customer with phone number (${payload.phone}) already exists ("${existing[0].name}")` });
        return;
      }
    }
  }

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
    const updated = Array.isArray(rows) && rows.length > 0 ? rows[0] : { id, ...payload };
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
