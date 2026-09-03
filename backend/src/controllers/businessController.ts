import { Response } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/mysql.js';
import { AuthRequest } from '../middleware/auth.js';

export async function createBusiness(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { business_name, member_name = '', business_currency = 'INR' } = req.body;

  if (!business_name || !business_name.trim()) {
    res.status(400).json({ error: 'Business name is required' });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if user already has a business profile
    const [existingProfile]: any = await connection.query(
      'SELECT id FROM profiles WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (Array.isArray(existingProfile) && existingProfile.length > 0) {
      await connection.rollback();
      res.status(400).json({ error: 'User already belongs to a business' });
      connection.release();
      return;
    }

    const businessId = crypto.randomUUID();
    const cleanName = business_name.trim();
    const cleanCurrency = (business_currency || 'INR').trim().toUpperCase();
    const cleanMemberName = (member_name || req.user.email).trim();

    // 1. Insert business
    await connection.query(
      'INSERT INTO businesses (id, name, currency) VALUES (?, ?, ?)',
      [businessId, cleanName, cleanCurrency]
    );

    // 2. Insert profile
    await connection.query(
      'INSERT INTO profiles (id, business_id, full_name, role) VALUES (?, ?, ?, ?)',
      [req.user.id, businessId, cleanMemberName, 'owner']
    );

    // 3. Insert settings
    await connection.query(
      'INSERT INTO settings (business_id, currency) VALUES (?, ?)',
      [businessId, cleanCurrency]
    );

    await connection.commit();
    connection.release();

    const [bizRows]: any = await pool.query('SELECT * FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    const createdBiz = Array.isArray(bizRows) && bizRows.length > 0 ? bizRows[0] : { id: businessId, name: cleanName, currency: cleanCurrency };

    res.json(createdBiz);
  } catch (err: any) {
    await connection.rollback();
    connection.release();
    console.error('Create business error:', err);
    res.status(500).json({ error: err.message || 'Failed to create business' });
  }
}
