import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/mysql.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    business_id?: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'billingmaster_super_secret_jwt_key_2026';

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    
    // Fetch business_id for this profile
    let business_id: string | null = null;
    try {
      const [rows]: any = await pool.query(
        'SELECT business_id FROM profiles WHERE id = ? LIMIT 1',
        [decoded.id]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        business_id = rows[0].business_id;
      }
    } catch (e) {
      // Ignore if DB query fails
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      business_id,
    };
    next();
  } catch (err) {
    req.user = undefined;
    next();
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
