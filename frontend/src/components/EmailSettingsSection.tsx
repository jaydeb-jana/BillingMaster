import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Mail, Send, Server, FileText, CheckCircle2, AlertCircle, Info, Sparkles, Code2, Eye, RefreshCw, HelpCircle, Key, ShieldCheck
} from 'lucide-react';
import { emailApi, getSupabaseErrorMessage } from '@/lib/api';

const VARIABLE_TAGS = [
  { tag: '{customer_name}', label: 'Customer Name', hint: 'e.g. John Doe' },
  { tag: '{customer_email}', label: 'Customer Email', hint: 'e.g. john@example.com' },
  { tag: '{invoice_number}', label: 'Invoice No.', hint: 'e.g. INV-0042' },
  { tag: '{issue_date}', label: 'Issue Date', hint: 'e.g. 03 Sep 2026' },
  { tag: '{due_date}', label: 'Due Date', hint: 'e.g. 10 Sep 2026' },
  { tag: '{total_amount}', label: 'Total Amount', hint: 'e.g. ₹2,500.00' },
  { tag: '{paid_amount}', label: 'Paid Amount', hint: 'e.g. ₹1,000.00' },
  { tag: '{due_balance}', label: 'Due Balance', hint: 'e.g. ₹1,500.00' },
  { tag: '{business_name}', label: 'Business Name', hint: 'e.g. BillingMaster Store' },
  { tag: '{items_table}', label: 'Items Table', hint: 'HTML table of items' },
];

export function EmailSettingsSection({ defaultBusinessName = '' }: { defaultBusinessName?: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoice' | 'receipt' | 'reminder'>('invoice');
  const [showPreview, setShowPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);

  const [form, setForm] = useState({
    display_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    invoice_email_subject: '',
    invoice_email_template: '',
    receipt_email_subject: '',
    receipt_email_template: '',
    reminder_email_subject: '',
    reminder_email_template: '',
    auto_send_invoice: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const data = await emailApi.getConfig();
      if (data) {
        setForm({
          display_name: data.display_name || defaultBusinessName || 'BillingMaster Sales',
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_secure: Boolean(data.smtp_secure),
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          from_email: data.from_email || '',
          invoice_email_subject: data.invoice_email_subject || 'Invoice {invoice_number} from {business_name}',
          invoice_email_template: data.invoice_email_template || '',
          receipt_email_subject: data.receipt_email_subject || 'Payment Receipt for Invoice {invoice_number} - {business_name}',
          receipt_email_template: data.receipt_email_template || '',
          reminder_email_subject: data.reminder_email_subject || 'Payment Reminder: Invoice {invoice_number} - {business_name}',
          reminder_email_template: data.reminder_email_template || '',
          auto_send_invoice: Boolean(data.auto_send_invoice),
        });
      }
    } catch (err: any) {
      console.warn('Failed to load email config:', err);
      toast.error('Could not load email configuration.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await emailApi.saveConfig(form);
      toast.success('Email settings & templates saved successfully!');
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Failed to save email configuration.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    setTesting(true);
    try {
      const res = await emailApi.sendTest(testEmailAddress, form.display_name);
      if (res.success) {
        toast.success(res.message || `Test email sent to ${testEmailAddress}! Check your inbox.`);
        setShowTestModal(false);
      }
    } catch (err: any) {
      toast.error(getSupabaseErrorMessage(err, 'Failed to send test email. Please check your SMTP credentials.'));
    } finally {
      setTesting(false);
    }
  }

  function insertVariable(tag: string) {
    if (activeTab === 'invoice') {
      setForm((prev) => ({ ...prev, invoice_email_template: prev.invoice_email_template + ' ' + tag }));
    } else if (activeTab === 'receipt') {
      setForm((prev) => ({ ...prev, receipt_email_template: prev.receipt_email_template + ' ' + tag }));
    } else {
      setForm((prev) => ({ ...prev, reminder_email_template: prev.reminder_email_template + ' ' + tag }));
    }
    toast.info(`Inserted tag ${tag}`);
  }

  function getActiveTemplateBody() {
    if (activeTab === 'invoice') return form.invoice_email_template;
    if (activeTab === 'receipt') return form.receipt_email_template;
    return form.reminder_email_template;
  }

  function getActiveSubject() {
    if (activeTab === 'invoice') return form.invoice_email_subject;
    if (activeTab === 'receipt') return form.receipt_email_subject;
    return form.reminder_email_subject;
  }

  function renderSamplePreview(rawHtml: string, rawSubject: string) {
    const sampleVars: Record<string, string> = {
      '{customer_name}': 'John Doe',
      '{customer_email}': 'john@example.com',
      '{invoice_number}': 'INV-0042',
      '{issue_date}': '03 Sep 2026',
      '{due_date}': '10 Sep 2026',
      '{total_amount}': '₹2,500.00',
      '{paid_amount}': '₹1,000.00',
      '{due_balance}': '₹1,500.00',
      '{business_name}': form.display_name || defaultBusinessName || 'My Business Store',
      '{items_table}': `
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin:10px 0;">
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:6px; border:1px solid #e2e8f0;">Item</th>
            <th style="padding:6px; border:1px solid #e2e8f0; text-align:center;">Qty</th>
            <th style="padding:6px; border:1px solid #e2e8f0; text-align:right;">Price</th>
          </tr>
          <tr>
            <td style="padding:6px; border:1px solid #f1f5f9;">Sample Product A</td>
            <td style="padding:6px; border:1px solid #f1f5f9; text-align:center;">2</td>
            <td style="padding:6px; border:1px solid #f1f5f9; text-align:right;">₹1,000.00</td>
          </tr>
          <tr>
            <td style="padding:6px; border:1px solid #f1f5f9;">Sample Product B</td>
            <td style="padding:6px; border:1px solid #f1f5f9; text-align:center;">1</td>
            <td style="padding:6px; border:1px solid #f1f5f9; text-align:right;">₹500.00</td>
          </tr>
        </table>
      `,
    };

    let subject = rawSubject;
    let body = rawHtml;

    Object.entries(sampleVars).forEach(([k, v]) => {
      subject = subject.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
      body = body.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
    });

    return { subject, body };
  }

  const isConnected = Boolean(form.smtp_host && form.smtp_user);

  if (loading) {
    return (
      <div className="card-shell p-6 space-y-4">
        <div className="skeleton h-6 w-48 rounded-md" />
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    );
  }

  const preview = renderSamplePreview(getActiveTemplateBody(), getActiveSubject());

  return (
    <section className="space-y-6">
      {/* Header Banner */}
      <div className="card-shell p-5 sm:p-7 border-l-4 border-l-primary bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                Email Settings & Templates
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={13} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <AlertCircle size={13} /> Not Configured
                  </span>
                )}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Set up custom Sender Display Name, Nodemailer SMTP connection, and billing email templates.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3.5 py-2 text-xs font-bold text-foreground transition-all hover:bg-muted"
            >
              <HelpCircle size={14} className="text-primary" /> Setup Guide
            </button>
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition-all hover:bg-primary/20"
            >
              <Send size={14} /> Send Test Email
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Display Name & Sender Settings */}
        <div className="card-shell p-5 sm:p-7 space-y-5">
          <div className="border-b border-border/60 pb-4">
            <h4 className="text-sm font-extrabold flex items-center gap-2">
              <Mail size={16} className="text-primary" />
              1. Sender Display Name & From Email
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              This name and email will be shown as the sender when customers receive invoices and receipts.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-xs font-bold">
              Sender Display Name (Required)
              <input
                type="text"
                placeholder="e.g. My Store Sales / Billing Team"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                required
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-sender-display-name"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground font-normal">
                Appears in customer email inbox (e.g. "<strong>{form.display_name || 'My Store'}</strong> &lt;billing@domain.com&gt;")
              </p>
            </label>

            <label className="block text-xs font-bold">
              Sender From Email
              <input
                type="email"
                placeholder="e.g. billing@yourdomain.com"
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-sender-from-email"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground font-normal">
                Leave empty to default to your SMTP account email.
              </p>
            </label>
          </div>

          {/* Auto-send Invoice Toggle */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground">Auto-Send Invoice Email on Billing</span>
              <p className="text-[11px] text-muted-foreground">
                Automatically dispatch invoice email via Nodemailer as soon as a bill is created.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={form.auto_send_invoice}
                onChange={(e) => setForm({ ...form, auto_send_invoice: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
                data-testid="checkbox-auto-send-email"
              />
            </label>
          </div>
        </div>

        {/* 2. Nodemailer SMTP Connection Settings */}
        <div className="card-shell p-5 sm:p-7 space-y-5">
          <div className="border-b border-border/60 pb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                <Server size={16} className="text-primary" />
                2. Nodemailer SMTP Server Credentials
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure your SMTP server credentials (Gmail, SendGrid, Hostinger, Mailtrap, etc.).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="text-xs font-bold text-primary hover:underline"
            >
              How to connect?
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-xs font-bold sm:col-span-2">
              SMTP Host Server
              <input
                type="text"
                placeholder="e.g. smtp.gmail.com or smtp.mailtrap.io"
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-smtp-host"
              />
            </label>

            <label className="block text-xs font-bold">
              SMTP Port
              <input
                type="number"
                placeholder="587"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) || 587 })}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-smtp-port"
              />
            </label>

            <label className="block text-xs font-bold sm:col-span-2">
              SMTP Username / Email
              <input
                type="text"
                placeholder="your-email@gmail.com"
                value={form.smtp_user}
                onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-smtp-user"
              />
            </label>

            <label className="block text-xs font-bold">
              SMTP Password / App Key
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={form.smtp_pass}
                onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
                data-testid="input-smtp-pass"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.smtp_secure}
                onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              Use SSL/TLS Security (Port 465)
            </label>
          </div>
        </div>

        {/* 3. Customizable Billing Email Templates */}
        <div className="card-shell p-5 sm:p-7 space-y-5">
          <div className="border-b border-border/60 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                3. Customizable Email Templates & Dynamic Variables
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Customize billing email contents. Click any variable badge to insert dynamic placeholders.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('invoice')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === 'invoice' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Invoice Template
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('receipt')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === 'receipt' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Payment Receipt
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reminder')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === 'reminder' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Reminder
              </button>
            </div>
          </div>

          {/* Dynamic Variable Badges */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
              <Sparkles size={13} /> Click to insert dynamic billing variable:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_TAGS.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  title={v.hint}
                  className="rounded-lg border border-primary/30 bg-background px-2.5 py-1 text-xs font-mono font-semibold text-primary transition-all hover:bg-primary hover:text-white"
                >
                  {v.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Template Subject & Body Inputs */}
          <div className="space-y-4">
            <label className="block text-xs font-bold">
              Email Subject Line
              <input
                type="text"
                value={
                  activeTab === 'invoice'
                    ? form.invoice_email_subject
                    : activeTab === 'receipt'
                    ? form.receipt_email_subject
                    : form.reminder_email_subject
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeTab === 'invoice') setForm({ ...form, invoice_email_subject: val });
                  else if (activeTab === 'receipt') setForm({ ...form, receipt_email_subject: val });
                  else setForm({ ...form, reminder_email_subject: val });
                }}
                className="input-shell mt-2 w-full px-3.5 py-2.5 text-sm font-medium"
              />
            </label>

            <label className="block text-xs font-bold">
              Email Body (HTML / Plain Text)
              <textarea
                rows={10}
                value={
                  activeTab === 'invoice'
                    ? form.invoice_email_template
                    : activeTab === 'receipt'
                    ? form.receipt_email_template
                    : form.reminder_email_template
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeTab === 'invoice') setForm({ ...form, invoice_email_template: val });
                  else if (activeTab === 'receipt') setForm({ ...form, receipt_email_template: val });
                  else setForm({ ...form, reminder_email_template: val });
                }}
                className="input-shell mt-2 w-full font-mono text-xs leading-relaxed p-3.5"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <Eye size={14} /> {showPreview ? 'Hide Live Preview' : 'Show Live Rendered Preview'}
              </button>
            </div>

            {/* Live Rendered Email Preview */}
            {showPreview && (
              <div className="rounded-xl border border-border bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-bold text-muted-foreground">
                  <span>Subject: {preview.subject}</span>
                  <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded">Sample Live Render</span>
                </div>
                <div
                  className="bg-white p-4 rounded-lg shadow-xs overflow-x-auto text-slate-800 text-sm"
                  dangerouslySetInnerHTML={{ __html: preview.body }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary rounded-xl px-6 py-2.5 text-xs font-bold shadow-sm"
            data-testid="btn-save-email-settings"
          >
            {saving ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>
      </form>

      {/* Setup Instructions Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="card-shell max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Server size={18} className="text-primary" />
                SMTP Setup Guide for Admin / Owner
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-foreground">
              <p>
                You can configure Nodemailer email delivery either directly in your server's <code className="bg-muted px-1.5 py-0.5 rounded text-primary">backend/.env</code> file or right here in the UI.
              </p>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <h4 className="font-bold text-primary flex items-center gap-1.5">
                  <Key size={14} /> Option A: Gmail SMTP (App Password)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Enable <strong>2-Step Verification</strong> on your Google Account.</li>
                  <li>Go to <strong>Google Account Security</strong> &gt; <strong>App passwords</strong>.</li>
                  <li>Create an app password named <code className="text-foreground font-mono">BillingMaster</code>.</li>
                  <li>Set Host: <code className="text-foreground font-mono">smtp.gmail.com</code>, Port: <code className="text-foreground font-mono">587</code>.</li>
                  <li>Use your full Gmail address as Username and the 16-character App Password as Password.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <h4 className="font-bold text-foreground">Option B: Custom SMTP / Hostinger / SendGrid</h4>
                <p className="text-muted-foreground">
                  Use your domain host's SMTP credentials (e.g., <code className="font-mono">smtp.hostinger.com</code>, port 587 or 465).
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <h4 className="font-bold text-foreground">Option C: Backend Environment File (.env)</h4>
                <pre className="bg-slate-950 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password
SMTP_FROM_NAME="BillingMaster Sales"
SMTP_FROM_EMAIL=your-email@gmail.com`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="btn-primary rounded-xl px-5 py-2 text-xs font-bold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="card-shell max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Send size={18} className="text-primary" />
                Send Test Email
              </h3>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Send a test email using <strong>{form.display_name || 'Display Name'}</strong> to verify your Nodemailer SMTP connection.
            </p>

            <label className="block text-xs font-bold space-y-2">
              Recipient Email Address
              <input
                type="email"
                placeholder="your-email@example.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="input-shell w-full px-3.5 py-2.5 text-sm font-medium"
              />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="rounded-xl border border-border/80 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={testing}
                className="btn-primary rounded-xl px-5 py-2 text-xs font-bold"
              >
                {testing ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
