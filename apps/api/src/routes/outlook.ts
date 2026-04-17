/**
 * Microsoft Outlook / Graph integration routes — App-Only (Client Credentials) flow.
 *
 * No user sign-in required. Uses application permissions with:
 *  - Client ID + Client Secret + Tenant ID from the Integration table
 *  - Sender Email stored in Integration.config
 *
 * Provides:
 *  - Status check
 *  - Send test email
 *  - Token acquisition helper (used by notifications.ts)
 *
 * Azure AD app registration must have the **Application** permission `Mail.Send`
 * (not Delegated) with admin consent granted.
 */

import { FastifyInstance } from 'fastify';
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

/** Read the full Outlook config from the Integration table. */
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
      const hasCredentials = !!(integration.clientId && integration.clientSecret);
      const hasTenant = !!cfg.tenantId;
      const hasSender = !!cfg.senderEmail;
      const configured = hasCredentials && hasTenant && hasSender;

      // Verify we can actually get a token
      let connected = false;
      if (configured) {
        const result = await getAppOnlyToken();
        connected = !!result;
      }

      reply.send({
        enabled: true,
        configured,
        connected,
        senderEmail: configured ? (cfg.senderEmail as string) : null,
        tenantId: hasTenant ? (cfg.tenantId as string) : null,
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

    const result = await getAppOnlyToken();
    if (!result) {
      return reply.code(400).send({
        error: 'Outlook is not configured. Please set Client ID, Client Secret, Tenant ID, and Sender Email in Settings → Integrations.',
      });
    }

    // Get the requester's email to send test to
    const sender = await prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, name: true } });
    if (!sender?.email) {
      return reply.code(400).send({ error: 'No email found for your account.' });
    }

    try {
      const res = await fetch(`${MS_GRAPH_URL}/users/${encodeURIComponent(result.senderEmail)}/sendMail`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${result.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: 'TischlerCRM - Outlook Connection Test',
            body: {
              contentType: 'HTML',
              content: `<p>Hello ${sender.name || sender.email},</p><p>This is a test email confirming your Outlook integration with TischlerCRM is working correctly.</p><p>Emails are sent from <strong>${result.senderEmail}</strong> using application permissions (no personal account needed).</p>`,
            },
            toRecipients: [{ emailAddress: { address: sender.email } }],
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Graph sendMail failed: ${res.status} ${errText}`);
      }

      reply.send({ sent: true, message: `Test email sent to ${sender.email} from ${result.senderEmail}` });
    } catch (err: any) {
      req.log.error(err, 'POST /outlook/test-email failed');
      reply.code(500).send({ error: `Failed to send test email: ${err.message}` });
    }
  });
}
