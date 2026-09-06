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
    const cleanEmail = email.toLowerCase().trim();
    const [existing]: any = await pool.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
    if (Array.isArray(existing) && existing.length > 0) {
      const existingId = existing[0].id;
      // Verify if existing user has an active merchant store profile
      const [profRows]: any = await pool.query('SELECT business_id FROM profiles WHERE id = ? LIMIT 1', [existingId]);
      let isOrphaned = false;
      if (!Array.isArray(profRows) || profRows.length === 0) {
        isOrphaned = true;
      } else if (profRows[0]?.business_id) {
        const [bizRows]: any = await pool.query('SELECT id FROM businesses WHERE id = ? LIMIT 1', [profRows[0].business_id]);
        if (!Array.isArray(bizRows) || bizRows.length === 0) {
          isOrphaned = true;
        }
      }

      if (isOrphaned) {
        // Automatically purge stale/deleted merchant user credentials so new account can be created seamlessly
        await pool.query('DELETE FROM profiles WHERE id = ?', [existingId]);
        await pool.query('DELETE FROM users WHERE id = ? OR LOWER(email) = ?', [existingId, cleanEmail]);
      } else {
        res.status(400).json({ error: 'User already exists with this email' });
        return;
      }
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

export async function changePassword(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { oldPassword, otp, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  try {
    const userId = req.user.id;
    const [userRows]: any = await pool.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [userId]);

    if (!Array.isArray(userRows) || userRows.length === 0) {
      res.status(404).json({ error: 'User account not found' });
      return;
    }

    if (oldPassword) {
      const isMatch = await bcrypt.compare(oldPassword, userRows[0].password_hash || '');
      if (!isMatch) {
        res.status(400).json({ error: 'Incorrect current password' });
        return;
      }
    } else if (otp) {
      if (otp !== '123456') {
        res.status(400).json({ error: 'Invalid verification OTP. Please enter 123456.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Please enter your current password or verification OTP' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    console.error('Change password error:', err);
    res.status(500).json({ error: err.message || 'Failed to change password' });
  }
}

export async function sendOtp(req: AuthRequest, res: Response) {
  res.json({
    success: true,
    message: 'Verification OTP sent to your registered email (Default OTP: 123456)',
    otp: '123456',
  });
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { otp } = req.body;
  if (!otp || otp !== '123456') {
    res.status(400).json({ error: 'Invalid verification OTP. Please enter 123456 to confirm deletion.' });
    return;
  }

  try {
    const userId = req.user.id;

    // Retrieve business ID associated with profile or user
    const [profileRows]: any = await pool.query('SELECT business_id FROM profiles WHERE id = ? LIMIT 1', [userId]);
    let businessId = Array.isArray(profileRows) && profileRows[0]?.business_id ? profileRows[0].business_id : null;

    if (!businessId) {
      const [uRows]: any = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
      if (Array.isArray(uRows) && uRows[0]?.email) {
        const [bRows]: any = await pool.query('SELECT id FROM businesses WHERE LOWER(email) = ? LIMIT 1', [uRows[0].email.toLowerCase()]);
        if (Array.isArray(bRows) && bRows[0]?.id) {
          businessId = bRows[0].id;
        }
      }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      if (businessId) {
        await pool.query('DELETE FROM payments WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE business_id = ?)', [businessId]);
        await pool.query('DELETE FROM invoices WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE business_id = ?)', [businessId]);
        await pool.query('DELETE FROM purchases WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM products WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM customers WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM suppliers WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM categories WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM stock_transactions WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM khata_entries WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM expenses WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM subscriptions WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM settings WHERE business_id = ?', [businessId]);
        await pool.query('DELETE FROM profiles WHERE business_id = ? OR id = ?', [businessId, userId]);
        await pool.query('DELETE FROM businesses WHERE id = ?', [businessId]);
      } else {
        await pool.query('DELETE FROM profiles WHERE id = ?', [userId]);
      }
      await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    } finally {
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    res.json({ success: true, message: 'Your account and all business data have been permanently deleted.' });
  } catch (err: any) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete account' });
  }
}
