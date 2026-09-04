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

    // Generate unique catalog handle/slug
    let baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
    if (baseSlug.length < 3) {
      const shortId = businessId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase();
      baseSlug = `store-${shortId}`;
    }

    let finalSlug = baseSlug;
    let counter = 1;
    while (true) {
      const [dup]: any = await connection.query(
        'SELECT id FROM businesses WHERE LOWER(catalog_slug) = ? OR LOWER(catalog_handle) = ? LIMIT 1',
        [finalSlug, finalSlug]
      );
      if (!Array.isArray(dup) || dup.length === 0) break;
      finalSlug = `${baseSlug}-${counter++}`;
    }

    // 1. Insert business with catalog_slug and catalog_handle
    await connection.query(
      'INSERT INTO businesses (id, name, currency, catalog_slug, catalog_handle) VALUES (?, ?, ?, ?, ?)',
      [businessId, cleanName, cleanCurrency, finalSlug, finalSlug]
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

export async function checkCatalogHandle(req: AuthRequest, res: Response) {
  try {
    const rawHandle = String(req.query.handle || '').trim().toLowerCase();
    const excludeId = String(req.query.excludeId || req.query.exclude_id || '').trim();
    const cleanHandle = rawHandle.replace(/[^a-z0-9_-]/g, '');

    if (!cleanHandle || cleanHandle.length < 3) {
      res.status(400).json({ available: false, error: 'Catalog handle must be at least 3 characters long.' });
      return;
    }

    const [existing]: any = await pool.query(
      `SELECT id, name FROM businesses WHERE id != ? AND (
        LOWER(catalog_slug) = ? OR 
        LOWER(catalog_handle) = ?
      ) LIMIT 1`,
      [excludeId || '', cleanHandle, cleanHandle]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      const [allRows]: any = await pool.query('SELECT catalog_slug, catalog_handle FROM businesses');
      const takenSet = new Set(
        (Array.isArray(allRows) ? allRows : []).map((r: any) => String(r.catalog_slug || r.catalog_handle || '').toLowerCase())
      );
      const candidates = [`${cleanHandle}-1`, `${cleanHandle}-store`, `${cleanHandle}-official`, `${cleanHandle}-shop`].filter(
        c => !takenSet.has(c)
      );
      res.json({
        available: false,
        takenBy: existing[0].name,
        suggestedHandles: candidates.slice(0, 3),
        message: `The catalog handle "${cleanHandle}" is already taken by another store ("${existing[0].name}").`
      });
      return;
    }

    res.json({ available: true, handle: cleanHandle });
  } catch (err: any) {
    console.error('Check catalog handle error:', err);
    res.status(500).json({ error: err.message || 'Failed to check catalog handle availability' });
  }
}

