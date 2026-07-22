/**
 * Microsoft Outlook / Graph integration routes — App-Only (Client Credentials) flow,
 * plus a plain-SMTP alternative for accounts that don't have a Microsoft 365 /
 * Azure AD tenant (e.g. a free outlook.com mailbox).
 *
 * Graph (OAuth) mode — no user sign-in required. Uses application permissions with:
 *  - Client ID + Client Secret + Tenant ID from the Integration table
 *  - Sender Email stored in Integration.config
 *
 * SMTP mode — for any mailbox reachable via standard SMTP AUTH (e.g. a free
 * outlook.com account). Uses:
 *  - SMTP host/port/secure + username from Integration.config
 *  - Password (or app password, if the account has 2FA) stored encrypted in
 *    the Integration.apiKey column (reused — SMTP has no OAuth client secret).
 *
 * Integration.config.authMethod selects which mode is active: 'smtp' or
 * anything else (default) for Graph/OAuth.
 *
 * Provides:
 *  - Status check
 *  - Send test email
 *  - Token acquisition helper (used by notifications.ts)
 *  - sendOutlookEmail() — unified send function used by notifications.ts and
 *    workflow-engine.ts, dispatching to Graph or SMTP based on authMethod.
 *
 * Azure AD app registration (Graph mode) must have the **Application**
 * permission `Mail.Send` (not Delegated) with admin consent granted.
 */

import { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';
import { prisma } from '@crm/db/client';
import { decrypt } from '../crypto';

// ── Constants ──────────────────────────────────────────────────────

const MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

// ── Helpers ────────────────────────────────────────────────────────

interface OutlookConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  senderEmail: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  senderEmail: string;
}

/** Read the full Outlook (Graph/OAuth) config from the Integration table. */
async function getOutlookConfig(): Promise<OutlookConfig | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
  if (!integration || !integration.enabled || !integration.clientId || !integration.clientSecret) {
    return null;
  }
  const cfg = (integration.config as Record<string, any>) || {};
  const tenantId = cfg.tenantId as string | undefined;
  const senderEmail = cfg.senderEmail as string | undefined;
  if (!tenantId || !senderEmail) return null;

  try {
    return {
      clientId: integration.clientId,
      clientSecret: decrypt(integration.clientSecret),
      tenantId,
      senderEmail,
    };
  } catch (err: any) {
    console.error('[outlook] Failed to decrypt clientSecret:', err.message);
    return null;
  }
}

/** Read the SMTP config from the Integration table (apiKey column reused for the password). */
async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
  if (!integration || !integration.enabled || !integration.apiKey) return null;
  const cfg = (integration.config as Record<string, any>) || {};
  const host = cfg.smtpHost as string | undefined;
  const port = cfg.smtpPort as number | undefined;
  const username = cfg.smtpUsername as string | undefined;
  const senderEmail = (cfg.senderEmail as string | undefined) || username;
  if (!host || !port || !username || !senderEmail) return null;

  try {
    return {
      host,
      port,
      secure: cfg.smtpSecure !== false, // default true unless explicitly disabled
      username,
      password: decrypt(integration.apiKey),
      senderEmail,
    };
  } catch (err: any) {
    console.error('[outlook] Failed to decrypt SMTP password:', err.message);
    return null;
  }
}

/** Which mode is currently configured for the 'outlook' provider. */
async function getAuthMethod(): Promise<'smtp' | 'oauth'> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
  const cfg = (integration?.config as Record<string, any>) || {};
  return cfg.authMethod === 'smtp' ? 'smtp' : 'oauth';
}

async function sendViaSmtp(config: SmtpConfig, to: string, subject: string, body: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Port 587 uses STARTTLS (secure:false + requireTLS), port 465 uses implicit TLS (secure:true).
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.username, pass: config.password },
  });
  await transporter.sendMail({
    from: config.senderEmail,
    to,
    subject,
    html: body,
  });
}

/**
 * Unified send function — used by notifications.ts and workflow-engine.ts.
 * Dispatches to Graph (app-only) or SMTP depending on how the 'outlook'
 * integration is configured. Returns whether the email was actually sent.
 */
export async function sendOutlookEmail(to: string, subject: string, body: string): Promise<boolean> {
  const method = await getAuthMethod();
  if (method === 'smtp') {
    const config = await getSmtpConfig();
    if (!config) return false;
    try {
      await sendViaSmtp(config, to, subject, body);
      return true;
    } catch (err: any) {
      console.error('[outlook] SMTP send failed:', err.message);
      return false;
    }
  }

  const result = await getAppOnlyToken();
  if (!result) return false;
  try {
    const res = await fetch(
      `${MS_GRAPH_URL}/users/${encodeURIComponent(result.senderEmail)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${result.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: body },
            toRecipients: [{ emailAddress: { address: to } }],
          },
        }),
      }
    );
    if (!res.ok) {
      console.error(`[outlook] Graph sendMail failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[outlook] Graph send failed:', err.message);
    return false;
  }
}

/**
 * Acquire an app-only access token via the client_credentials grant.
 * Exported so notifications.ts can call it directly.
 */
export async function getAppOnlyToken(): Promise<{ token: string; senderEmail: string } | null> {
  const config = await getOutlookConfig();
  if (!config) return null;

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[outlook] Client credentials token request failed:', resp.status, errText);
    return null;
  }

  const data = (await resp.json()) as { access_token: string; expires_in: number };
  return { token: data.access_token, senderEmail: config.senderEmail };
}

// ── Routes ─────────────────────────────────────────────────────────

export async function outlookRoutes(app: FastifyInstance) {

  // ── Connection status ──
  app.get('/outlook/status', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
      if (!integration || !integration.enabled) {
        return reply.send({ enabled: false, configured: false, connected: false });
      }

      const cfg = (integration.config as Record<string, any>) || {};
      const authMethod: 'smtp' | 'oauth' = cfg.authMethod === 'smtp' ? 'smtp' : 'oauth';

      let configured: boolean;
      let connected = false;
      let senderEmail: string | null = null;

      if (authMethod === 'smtp') {
        const smtp = await getSmtpConfig();
        configured = !!smtp;
        senderEmail = smtp?.senderEmail ?? null;
        if (smtp) {
          try {
            const transporter = nodemailer.createTransport({
              host: smtp.host,
              port: smtp.port,
              secure: smtp.port === 465,
              requireTLS: smtp.port !== 465,
              auth: { user: smtp.username, pass: smtp.password },
            });
            await transporter.verify();
            connected = true;
          } catch (err: any) {
            console.error('[outlook] SMTP verify failed:', err.message);
          }
        }
      } else {
        const hasCredentials = !!(integration.clientId && integration.clientSecret);
        const hasTenant = !!cfg.tenantId;
        const hasSender = !!cfg.senderEmail;
        configured = hasCredentials && hasTenant && hasSender;
        senderEmail = configured ? (cfg.senderEmail as string) : null;
        if (configured) {
          const result = await getAppOnlyToken();
          connected = !!result;
        }
      }

      reply.send({
        enabled: true,
        configured,
        connected,
        authMethod,
        senderEmail,
        tenantId: authMethod === 'oauth' && cfg.tenantId ? (cfg.tenantId as string) : null,
      });
    } catch (err: any) {
      req.log.error(err, 'GET /outlook/status failed');
      reply.send({ enabled: false, configured: false, connected: false });
    }
  });

  // ── Send test email ──
  app.post('/outlook/test-email', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const sender = await prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, name: true } });
    if (!sender?.email) {
      return reply.code(400).send({ error: 'No email found for your account.' });
    }

    const method = await getAuthMethod();
    const senderLabel =
      method === 'smtp' ? (await getSmtpConfig())?.senderEmail : (await getOutlookConfig())?.senderEmail;

    if (!senderLabel) {
      return reply.code(400).send({
        error:
          method === 'smtp'
            ? 'SMTP is not fully configured. Please set Host, Port, Username, Password, and Sender Email in Settings → Integrations.'
            : 'Outlook is not configured. Please set Client ID, Client Secret, Tenant ID, and Sender Email in Settings → Integrations.',
      });
    }

    try {
      const sent = await sendOutlookEmail(
        sender.email,
        'TischlerCRM - Outlook Connection Test',
        `<p>Hello ${sender.name || sender.email},</p><p>This is a test email confirming your ${method === 'smtp' ? 'SMTP' : 'Outlook'} integration with TischlerCRM is working correctly.</p><p>Emails are sent from <strong>${senderLabel}</strong>.</p>`,
      );
      if (!sent) throw new Error('Send failed — check server logs for details.');
      reply.send({ sent: true, message: `Test email sent to ${sender.email} from ${senderLabel}` });
    } catch (err: any) {
      req.log.error(err, 'POST /outlook/test-email failed');
      reply.code(500).send({ error: `Failed to send test email: ${err.message}` });
    }
  });
}

