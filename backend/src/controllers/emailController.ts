import nodemailer from 'nodemailer';
import { Request, Response } from 'express';

/**
 * Test Gmail / SMTP connection via Nodemailer
 */
export async function testEmailConnection(req: Request, res: Response) {
  try {
    const { host, port, secure, user, pass } = req.body;

    if (!user || !pass) {
      return res.status(400).json({
        error: 'Gmail Address (user) and Google App Password (pass) are required.'
      });
    }

    const smtpHost = (host || 'smtp.gmail.com').trim();
    const smtpPort = Number(port) || 465;
    const isSecure = secure !== undefined ? Boolean(secure) : smtpPort === 465;
    const cleanPass = String(pass).trim().replace(/\s+/g, '');
    const cleanUser = String(user).trim();

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return res.json({
      success: true,
      message: 'Gmail SMTP connection verified successfully! Ready to send emails.',
      connection: {
        host: smtpHost,
        port: smtpPort,
        user: cleanUser
      }
    });
  } catch (err: any) {
    console.error('[EmailController] SMTP verify error:', err);
    let errorMsg = err?.message || 'Failed to connect to Gmail SMTP server.';
    if (errorMsg.includes('Invalid login') || errorMsg.includes('Username and Password not accepted') || errorMsg.includes('535-5.7.8')) {
      errorMsg = 'Invalid Gmail address or App Password. Please ensure 2-Step Verification is enabled on your Google Account and you are using a 16-character Google App Password.';
    }
    return res.status(400).json({
      error: errorMsg,
      details: err?.code || 'AUTH_FAILURE'
    });
  }
}

/**
 * Send email campaign to single or multiple recipients via Nodemailer
 */
export async function sendEmailCampaign(req: Request, res: Response) {
  try {
    const { host, port, secure, user, pass, fromName, recipients, subject, body, html, accounts, dispatchMode } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: 'At least one recipient email address is required.'
      });
    }

    if (!subject || !body) {
      return res.status(400).json({
        error: 'Email subject and body text are required.'
      });
    }

    // Build pool of transporter accounts
    interface TransporterConfig {
      transporter: any;
      user: string;
      senderName: string;
    }

    const pool: TransporterConfig[] = [];

    if (accounts && Array.isArray(accounts) && accounts.length > 0) {
      for (const acc of accounts) {
        if (acc.user && acc.pass) {
          const accHost = (acc.host || 'smtp.gmail.com').trim();
          const accPort = Number(acc.port) || 465;
          const accSecure = acc.secure !== false;
          const cleanAccPass = String(acc.pass).trim().replace(/\s+/g, '');
          const cleanAccUser = String(acc.user).trim();
          const accSender = acc.senderName ? String(acc.senderName).trim() : (fromName ? String(fromName).trim() : 'BillingMaster Merchant');

          const t = nodemailer.createTransport({
            host: accHost,
            port: accPort,
            secure: accSecure,
            auth: {
              user: cleanAccUser,
              pass: cleanAccPass,
            },
            connectionTimeout: 15000,
          });

          pool.push({
            transporter: t,
            user: cleanAccUser,
            senderName: accSender,
          });
        }
      }
    }

    // Fallback to single account if pool is empty
    if (pool.length === 0) {
      if (!user || !pass) {
        return res.status(400).json({
          error: 'Gmail Address and Google App Password are required.'
        });
      }
      const smtpHost = (host || 'smtp.gmail.com').trim();
      const smtpPort = Number(port) || 465;
      const isSecure = secure !== undefined ? Boolean(secure) : smtpPort === 465;
      const cleanPass = String(pass).trim().replace(/\s+/g, '');
      const cleanUser = String(user).trim();
      const senderName = fromName ? String(fromName).trim() : 'BillingMaster Merchant';

      pool.push({
        transporter: nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: isSecure,
          auth: { user: cleanUser, pass: cleanPass },
          connectionTimeout: 15000,
        }),
        user: cleanUser,
        senderName: senderName,
      });
    }

    const results: { email: string; success: boolean; error?: string; messageId?: string; sentFrom?: string }[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let poolIndex = 0;

    for (const recipient of recipients) {
      const targetEmail = typeof recipient === 'string' ? recipient.trim() : recipient?.email?.trim();
      if (!targetEmail || !targetEmail.includes('@')) {
        results.push({ email: targetEmail || 'invalid', success: false, error: 'Invalid recipient email address' });
        totalFailed++;
        continue;
      }

      // Determine active sender account based on dispatchMode
      let activeSender = pool[0];
      if (dispatchMode === 'random' && pool.length > 1) {
        const randIdx = Math.floor(Math.random() * pool.length);
        activeSender = pool[randIdx];
      } else if (dispatchMode === 'round-robin' && pool.length > 1) {
        activeSender = pool[poolIndex % pool.length];
        poolIndex++;
      }

      const formattedHtml = html || `
        <div style="font-family: Arial, sans-serif; color: #111827; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 16px; background-color: #ffffff;">
          <div style="padding-bottom: 16px; border-bottom: 2px solid #F97316; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #F97316; font-size: 22px; font-weight: 800;">${activeSender.senderName}</h2>
          </div>
          <div style="font-size: 14px; line-height: 1.7; white-space: pre-wrap; color: #374151;">
${body}
          </div>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #F3F4F6; font-size: 11px; color: #9CA3AF; text-align: center;">
            Sent via BillingMaster Email Marketing Studio • ${new Date().toLocaleDateString('en-US')}
          </div>
        </div>
      `;

      let lastErr: any = null;
      let sentSuccessfully = false;

      // Candidate accounts: Primary target first, then fallback to other pool accounts if auth/connection fails
      const candidateSenders = [activeSender, ...pool.filter(p => p.user !== activeSender.user)];

      for (const candidate of candidateSenders) {
        try {
          const info = await candidate.transporter.sendMail({
            from: `"${candidate.senderName}" <${candidate.user}>`,
            to: targetEmail,
            subject: String(subject).trim(),
            text: String(body),
            html: formattedHtml,
          });

          results.push({
            email: targetEmail,
            success: true,
            messageId: info.messageId,
            sentFrom: candidate.user,
          });
          totalSent++;
          sentSuccessfully = true;
          break;
        } catch (mailErr: any) {
          lastErr = mailErr;
          console.error(`[EmailController] Error sending email to ${targetEmail} via ${candidate.user}:`, mailErr?.message);
          // Automatic Failover: If candidate failed due to App Password revocation/2FA issue, try next pool account
        }
      }

      if (!sentSuccessfully) {
        let cleanErr = lastErr?.message || 'Failed to deliver email';
        if (cleanErr.includes('Invalid login') || cleanErr.includes('535-5.7.8') || cleanErr.includes('Username and Password not accepted')) {
          cleanErr = 'Invalid Gmail credentials or Google App Password revoked / 2FA disabled.';
        }
        results.push({
          email: targetEmail,
          success: false,
          error: cleanErr,
          sentFrom: activeSender.user,
        });
        totalFailed++;
      }
    }

    return res.json({
      success: totalSent > 0,
      totalSent,
      totalFailed,
      results,
      message: `Email campaign executed. ${totalSent} sent successfully, ${totalFailed} failed.`,
    });
  } catch (err: any) {
    console.error('[EmailController] Send campaign error:', err);
    return res.status(500).json({
      error: err?.message || 'Internal server error processing email campaign.',
    });
  }
}
