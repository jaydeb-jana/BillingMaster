import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { pool } from '../db/mysql.js';
import { AuthRequest } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'billingmaster_super_secret_jwt_key_2026';

function generateToken(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

export async function signup(req: AuthRequest, res: Response) {
  const { email, password, options } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const fullName = options?.data?.full_name || options?.data?.name || '';
  const phone = options?.data?.phone || '';

  try {
    // Check if user exists
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
    if (Array.isArray(existing) && existing.length > 0) {
      res.status(400).json({ error: 'User already exists with this email' });
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (id, email, password_hash, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [userId, email.toLowerCase().trim(), passwordHash, fullName, phone]
    );

    const token = generateToken({ id: userId, email: email.toLowerCase().trim() });
    const userObj = {
      id: userId,
      email: email.toLowerCase().trim(),
      user_metadata: { full_name: fullName, name: fullName, phone },
    };

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: userObj,
      session: {
        access_token: token,
        token_type: 'bearer',
        user: userObj,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'Signup failed' });
  }
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Invalid login credentials' });
      return;
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(400).json({ error: 'Invalid login credentials' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email });
    const userObj = {
      id: user.id,
      email: user.email,
      user_metadata: { full_name: user.full_name, name: user.full_name, phone: user.phone },
    };

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: userObj,
      session: {
        access_token: token,
        token_type: 'bearer',
        user: userObj,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
}

export async function getSession(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.json({ session: null });
    return;
  }

  try {
    const [rows]: any = await pool.query('SELECT id, email, full_name, phone FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.json({ session: null });
      return;
    }

    const user = rows[0];
    const userObj = {
      id: user.id,
      email: user.email,
      user_metadata: { full_name: user.full_name, name: user.full_name, phone: user.phone },
    };

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';

    res.json({
      session: {
        access_token: token,
        token_type: 'bearer',
        user: userObj,
      },
    });
  } catch (err: any) {
    res.json({ session: null });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { data, password } = req.body;

  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(hash);
    }

    if (data?.full_name || data?.name) {
      updates.push('full_name = ?');
      values.push(data.full_name || data.name);
    }

    if (data?.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone);
    }

    if (updates.length > 0) {
      values.push(req.user.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Also update profile if exists
    if (data?.full_name || data?.name) {
      await pool.query('UPDATE profiles SET full_name = ? WHERE id = ?', [data.full_name || data.name, req.user.id]);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
}

export async function resetPassword(req: AuthRequest, res: Response) {
  const { email, password, otp } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and new password are required' });
    return;
  }

  if (otp && otp !== '123456') {
    res.status(400).json({ error: 'Invalid verification code. Please enter 123456.' });
    return;
  }

  try {
    const [rows]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(404).json({ error: 'No user account found with this email address' });
      return;
    }

    const userId = rows[0].id;
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
}
