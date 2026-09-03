import nodemailer from 'nodemailer';
import { pool } from '../db/mysql.js';
import crypto from 'node:crypto';

export interface EmailSettings {
  id?: string;
  business_id: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_email: string;
  invoice_email_subject: string;
  invoice_email_template: string;
  receipt_email_subject: string;
  receipt_email_template: string;
  reminder_email_subject: string;
  reminder_email_template: string;
  auto_send_invoice: boolean;
}

export const DEFAULT_INVOICE_SUBJECT = 'Invoice {invoice_number} from {business_name}';
export const DEFAULT_INVOICE_TEMPLATE = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #ea580c; color: #ffffff; padding: 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">{business_name}</h1>
    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Official Billing & Tax Invoice</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Dear {customer_name},</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      Thank you for your business! Please find the details for your recent bill <strong>#{invoice_number}</strong> below.
    </p>

    <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #f1f5f9;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Invoice Number:</td>
          <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #0f172a;">{invoice_number}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Issue Date:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a;">{issue_date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Due Date:</td>
          <td style="padding: 6px 0; text-align: right; color: #0f172a;">{due_date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Total Amount:</td>
          <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #ea580c; font-size: 16px;">{total_amount}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Paid Amount:</td>
          <td style="padding: 6px 0; text-align: right; color: #16a34a; font-weight: bold;">{paid_amount}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Balance Due:</td>
          <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: bold;">{due_balance}</td>
        </tr>
      </table>
    </div>

    {items_table}

    <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      If you have any questions regarding this invoice, please reach out to <strong>{business_name}</strong>.
    </p>
  </div>
  <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #64748b;">
    Powered by BillingMaster — Professional Invoicing System
  </div>
</div>
`.trim();

export const DEFAULT_RECEIPT_SUBJECT = 'Payment Receipt for Invoice {invoice_number} - {business_name}';
export const DEFAULT_RECEIPT_TEMPLATE = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #16a34a; color: #ffffff; padding: 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">{business_name}</h1>
    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Payment Confirmation Receipt</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Dear {customer_name},</h2>
    <p style="font-size: 14px; color: #475569;">
      We have received your payment of <strong>{paid_amount}</strong> for Invoice <strong>#{invoice_number}</strong>.
    </p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #15803d; font-weight: bold;">
        Remaining Balance: {due_balance}
      </p>
    </div>
    <p style="font-size: 13px; color: #64748b;">Thank you for your prompt payment!</p>
  </div>
</div>
`.trim();

export const DEFAULT_REMINDER_SUBJECT = 'Payment Reminder: Invoice {invoice_number} - {business_name}';
export const DEFAULT_REMINDER_TEMPLATE = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #dc2626; color: #ffffff; padding: 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 800;">{business_name}</h1>
    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Payment Reminder</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Dear {customer_name},</h2>
    <p style="font-size: 14px; color: #475569;">
      This is a friendly reminder that Invoice <strong>#{invoice_number}</strong> has a remaining balance of <strong>{due_balance}</strong> due on <strong>{due_date}</strong>.
    </p>
    <p style="font-size: 13px; color: #64748b;">Please clear your due payment at your earliest convenience.</p>
  </div>
</div>
`.trim();

/**
 * Get Email Configuration for a business from DB or ENV fallbacks
 */
export async function getEmailConfig(businessId: string): Promise<EmailSettings> {
  let dbConfig: any = null;

  try {
    const [rows]: any = await pool.query('SELECT * FROM email_settings WHERE business_id = ? LIMIT 1', [businessId]);
    if (Array.isArray(rows) && rows.length > 0) {
      dbConfig = rows[0];
    }
  } catch (e) {
    console.warn('[EmailService] Failed to load email_settings table from MySQL:', e);
  }

  // Get business info for default display name
  let businessName = 'BillingMaster Sales';
  try {
    const [bRows]: any = await pool.query('SELECT name FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    if (Array.isArray(bRows) && bRows.length > 0 && bRows[0].name) {
      businessName = bRows[0].name;
    }
  } catch (e) {}

  const host = dbConfig?.smtp_host || process.env.SMTP_HOST || '';
  const port = Number(dbConfig?.smtp_port || process.env.SMTP_PORT) || 587;
  const secure = dbConfig?.smtp_secure !== undefined ? Boolean(dbConfig.smtp_secure) : (process.env.SMTP_SECURE === 'true');
  const user = dbConfig?.smtp_user || process.env.SMTP_USER || '';
  const pass = dbConfig?.smtp_pass || process.env.SMTP_PASS || '';
  const displayName = dbConfig?.display_name || process.env.SMTP_FROM_NAME || businessName;
  const fromEmail = dbConfig?.from_email || process.env.SMTP_FROM_EMAIL || user || 'no-reply@billingmaster.com';

  return {
    id: dbConfig?.id,
    business_id: businessId,
    display_name: displayName,
    smtp_host: host,
    smtp_port: port,
    smtp_secure: secure,
    smtp_user: user,
    smtp_pass: pass,
    from_email: fromEmail,
    invoice_email_subject: dbConfig?.invoice_email_subject || DEFAULT_INVOICE_SUBJECT,
    invoice_email_template: dbConfig?.invoice_email_template || DEFAULT_INVOICE_TEMPLATE,
    receipt_email_subject: dbConfig?.receipt_email_subject || DEFAULT_RECEIPT_SUBJECT,
    receipt_email_template: dbConfig?.receipt_email_template || DEFAULT_RECEIPT_TEMPLATE,
    reminder_email_subject: dbConfig?.reminder_email_subject || DEFAULT_REMINDER_SUBJECT,
    reminder_email_template: dbConfig?.reminder_email_template || DEFAULT_REMINDER_TEMPLATE,
    auto_send_invoice: dbConfig?.auto_send_invoice !== undefined ? Boolean(dbConfig.auto_send_invoice) : false,
  };
}

/**
 * Save / Upsert Email Settings into MySQL
 */
export async function saveEmailConfig(config: Partial<EmailSettings> & { business_id: string }): Promise<EmailSettings> {
  const existing = await getEmailConfig(config.business_id);
  const id = existing.id || crypto.randomUUID();

  const updated: EmailSettings = {
    ...existing,
    ...config,
    id,
  };

  try {
    await pool.query(
      `INSERT INTO email_settings 
       (id, business_id, display_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_email, 
        invoice_email_subject, invoice_email_template, receipt_email_subject, receipt_email_template, 
        reminder_email_subject, reminder_email_template, auto_send_invoice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        display_name = VALUES(display_name),
        smtp_host = VALUES(smtp_host),
        smtp_port = VALUES(smtp_port),
        smtp_secure = VALUES(smtp_secure),
        smtp_user = VALUES(smtp_user),
        smtp_pass = VALUES(smtp_pass),
        from_email = VALUES(from_email),
        invoice_email_subject = VALUES(invoice_email_subject),
        invoice_email_template = VALUES(invoice_email_template),
        receipt_email_subject = VALUES(receipt_email_subject),
        receipt_email_template = VALUES(receipt_email_template),
        reminder_email_subject = VALUES(reminder_email_subject),
        reminder_email_template = VALUES(reminder_email_template),
        auto_send_invoice = VALUES(auto_send_invoice)`,
      [
        id,
        config.business_id,
        updated.display_name,
        updated.smtp_host,
        updated.smtp_port,
        updated.smtp_secure ? 1 : 0,
        updated.smtp_user,
        updated.smtp_pass,
        updated.from_email,
        updated.invoice_email_subject,
        updated.invoice_email_template,
        updated.receipt_email_subject,
        updated.receipt_email_template,
        updated.reminder_email_subject,
        updated.reminder_email_template,
        updated.auto_send_invoice ? 1 : 0,
      ]
    );
  } catch (e) {
    console.error('[EmailService] Save email config error:', e);
    throw e;
  }

  return updated;
}

/**
 * Creates Nodemailer Transporter based on configuration
 */
export function createTransporter(config: EmailSettings) {
  if (!config.smtp_host || !config.smtp_user) {
    throw new Error('SMTP credentials not configured. Please enter SMTP settings or configure process.env values.');
  }

  return nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Replace Template Variables ({customer_name}, {invoice_number}, {total_amount}, etc.)
 */
export function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, val || '');
  }
  return result;
}

/**
 * Send Test Email using configured SMTP
 */
export async function sendTestEmail(businessId: string, toEmail: string, displayNameOverride?: string): Promise<boolean> {
  const config = await getEmailConfig(businessId);
  const displayName = displayNameOverride || config.display_name || 'BillingMaster Test';

  const transporter = createTransporter(config);
  const fromHeader = `"${displayName}" <${config.from_email || config.smtp_user}>`;

  const info = await transporter.sendMail({
    from: fromHeader,
    to: toEmail,
    subject: `Test Email from ${displayName} - Nodemailer Connected`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #ea580c; margin-top: 0;">Nodemailer Connection Successful!</h2>
        <p>This is a test email sent from <strong>${displayName}</strong> using your configured SMTP server.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 15px 0;" />
        <p style="font-size: 12px; color: #64748b;">
          <strong>SMTP Host:</strong> ${config.smtp_host}:${config.smtp_port}<br />
          <strong>Display Name:</strong> ${displayName}<br />
          <strong>Sender Email:</strong> ${config.from_email || config.smtp_user}
        </p>
      </div>
    `,
  });

  console.log('[EmailService] Test email sent:', info.messageId);
  return true;
}

/**
 * Format and Send Invoice Email to Customer
 */
export async function sendInvoiceEmail(businessId: string, invoiceId: string, recipientEmailOverride?: string): Promise<{ success: boolean; message: string }> {
  const config = await getEmailConfig(businessId);

  // Load Invoice Details
  const [invRows]: any = await pool.query('SELECT * FROM invoices WHERE id = ? AND business_id = ? LIMIT 1', [invoiceId, businessId]);
  if (!Array.isArray(invRows) || invRows.length === 0) {
    throw new Error('Invoice not found');
  }
  const invoice = invRows[0];

  // Load Customer Details
  const [custRows]: any = await pool.query('SELECT * FROM customers WHERE id = ? LIMIT 1', [invoice.customer_id]);
  const customer = Array.isArray(custRows) && custRows.length > 0 ? custRows[0] : { name: 'Valued Customer', email: '' };

  const targetEmail = recipientEmailOverride || customer.email;
  if (!targetEmail) {
    throw new Error('Customer does not have a valid email address');
  }

  // Load Business Details
  const [bizRows]: any = await pool.query('SELECT name, currency FROM businesses WHERE id = ? LIMIT 1', [businessId]);
  const bizName = Array.isArray(bizRows) && bizRows.length > 0 ? bizRows[0].name : 'BillingMaster';
  const currencySymbol = (Array.isArray(bizRows) && bizRows.length > 0 && bizRows[0].currency === 'INR') ? '₹' : '';

  // Load Invoice Items
  const [items]: any = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

  let itemsHtml = `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">
      <thead>
        <tr style="background-color: #f1f5f9; text-align: left; color: #475569;">
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Item Description</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">Qty</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Price</th>
          <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      itemsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${item.description || 'Product'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${currencySymbol}${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold;">${currencySymbol}${Number(item.total).toFixed(2)}</td>
        </tr>
      `;
    }
  } else {
    itemsHtml += `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #94a3b8;">General Bill</td></tr>`;
  }

  itemsHtml += `</tbody></table>`;

  const templateVars: Record<string, string> = {
    customer_name: customer.name || 'Valued Customer',
    customer_email: targetEmail,
    invoice_number: invoice.invoice_number || 'INV',
    issue_date: invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-IN') : 'N/A',
    due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : 'N/A',
    total_amount: `${currencySymbol}${Number(invoice.total || 0).toFixed(2)}`,
    paid_amount: `${currencySymbol}${Number(invoice.paid_amount || 0).toFixed(2)}`,
    due_balance: `${currencySymbol}${Number(invoice.balance || 0).toFixed(2)}`,
    business_name: bizName,
    items_table: itemsHtml,
    payment_method: invoice.payment_method || 'N/A',
    notes: invoice.notes || '',
  };

  const subject = replaceVariables(config.invoice_email_subject || DEFAULT_INVOICE_SUBJECT, templateVars);
  const htmlBody = replaceVariables(config.invoice_email_template || DEFAULT_INVOICE_TEMPLATE, templateVars);

  const transporter = createTransporter(config);
  const fromHeader = `"${config.display_name || bizName}" <${config.from_email || config.smtp_user}>`;

  const info = await transporter.sendMail({
    from: fromHeader,
    to: targetEmail,
    subject,
    html: htmlBody,
  });

  console.log(`[EmailService] Sent invoice ${invoice.invoice_number} to ${targetEmail}. Message ID: ${info.messageId}`);
  return { success: true, message: `Invoice email sent to ${targetEmail}` };
}
