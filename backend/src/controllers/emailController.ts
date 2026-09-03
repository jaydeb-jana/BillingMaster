import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getEmailConfig,
  saveEmailConfig,
  sendTestEmail,
  sendInvoiceEmail,
} from '../services/emailService.js';

export async function getEmailConfigHandler(req: AuthRequest, res: Response) {
  if (!req.user || !req.user.business_id) {
    res.status(401).json({ error: 'Business membership required' });
    return;
  }

  try {
    const config = await getEmailConfig(req.user.business_id);
    res.json(config);
  } catch (err: any) {
    console.error('[EmailController] Get config error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch email settings' });
  }
}

export async function saveEmailConfigHandler(req: AuthRequest, res: Response) {
  if (!req.user || !req.user.business_id) {
    res.status(401).json({ error: 'Business membership required' });
    return;
  }

  try {
    const updated = await saveEmailConfig({
      ...req.body,
      business_id: req.user.business_id,
    });
    res.json(updated);
  } catch (err: any) {
    console.error('[EmailController] Save config error:', err);
    res.status(500).json({ error: err.message || 'Failed to save email settings' });
  }
}

export async function sendTestEmailHandler(req: AuthRequest, res: Response) {
  if (!req.user || !req.user.business_id) {
    res.status(401).json({ error: 'Business membership required' });
    return;
  }

  const { to_email, display_name } = req.body;
  if (!to_email) {
    res.status(400).json({ error: 'Recipient email address (to_email) is required' });
    return;
  }

  try {
    await sendTestEmail(req.user.business_id, to_email, display_name);
    res.json({ success: true, message: `Test email sent successfully to ${to_email}` });
  } catch (err: any) {
    console.error('[EmailController] Send test email error:', err);
    res.status(400).json({ error: err.message || 'Failed to send test email. Please check your SMTP settings.' });
  }
}

export async function sendInvoiceEmailHandler(req: AuthRequest, res: Response) {
  if (!req.user || !req.user.business_id) {
    res.status(401).json({ error: 'Business membership required' });
    return;
  }

  const { invoice_id, to_email } = req.body;
  if (!invoice_id) {
    res.status(400).json({ error: 'invoice_id is required' });
    return;
  }

  try {
    const result = await sendInvoiceEmail(req.user.business_id, invoice_id, to_email);
    res.json(result);
  } catch (err: any) {
    console.error('[EmailController] Send invoice email error:', err);
    res.status(400).json({ error: err.message || 'Failed to send invoice email' });
  }
}
