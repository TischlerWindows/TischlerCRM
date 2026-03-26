/**
 * Microsoft Outlook / Graph integration routes.
 *
 * Provides:
 *  - OAuth2 connect/callback flow (org-level — admin connects once for email sending)
 *  - Connection status check
 *  - Disconnect
 *  - Send test email
 *
 * Uses the same Integration / UserIntegration tables as Dropbox.
 * The token obtained here is used by notifications.ts to send invite & reset emails.
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { encrypt, decrypt } from '../crypto';
import { logAudit, extractIp } from '../audit';

// ── Constants ──────────────────────────────────────────────────────

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

// Scopes needed: send mail on behalf of the signed-in user + read profile
const MS_SCOPES = 'openid profile email offline_access Mail.Send User.Read';

// ── Helpers ────────────────────────────────────────────────────────

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ??
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '')
  );
}

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return 'http://localhost:4000';
}

/** Return a small HTML page that posts a message to the opener and closes. */
function oauthResultPage(status: 'connected' | 'error', reason?: string): string {
  const data = JSON.stringify({ type: 'outlook-oauth-result', status, reason });
  return `<!DOCTYPE html><html><body><p>${status === 'connected' ? 'Connected! This window will close.' : 'Authorization failed.'}</p><script>
if(window.opener){window.opener.postMessage(${data},'*');}
setTimeout(function(){window.close();},1500);
</script></body></html>`;
}

/** Get the org-level Outlook credentials (clientId, clientSecret). */
async function getOutlookCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
  if (!integration || !integration.enabled || !integration.clientId || !integration.clientSecret) {
    return null;
  }
  try {
    return {
      clientId: integration.clientId,
      clientSecret: decrypt(integration.clientSecret),
    };
  } catch (err: any) {
    console.error('[outlook] Failed to decrypt clientSecret:', err.message);
    return null;
  }
}

// ── Routes ─────────────────────────────────────────────────────────

export async function outlookRoutes(app: FastifyInstance) {

  // ── OAuth: Initiate Authorization ──
  app.get('/outlook/connect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const creds = await getOutlookCredentials();
      if (!creds) {
        return reply.code(400).send({
          error: 'Outlook integration is not configured. Ask an admin to set up the Client ID and Client Secret in Settings → Connected Apps.',
        });
      }

      const nonce = crypto.randomUUID();
      const state = Buffer.from(JSON.stringify({ userId: user.sub, nonce })).toString('base64url');
      const callbackUrl = `${getApiBaseUrl()}/outlook/callback`;

      const params = new URLSearchParams({
        client_id: creds.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: MS_SCOPES,
        state,
        response_mode: 'query',
        prompt: 'consent',
      });

      reply.send({ url: `${MS_AUTH_URL}?${params}` });
    } catch (err: any) {
      req.log.error(err, 'GET /outlook/connect failed');
      reply.code(500).send({ error: 'Failed to start Outlook authorization.' });
    }
  });

  // ── OAuth: Callback (code → tokens) ──
  app.get('/outlook/callback', async (req, reply) => {
    const { code, state, error: oauthError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (oauthError || !code || !state) {
      return reply.type('text/html').send(oauthResultPage('error', oauthError || 'missing_code'));
    }

    // Decode state to get userId
    let stateData: { userId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return reply.type('text/html').send(oauthResultPage('error', 'invalid_state'));
    }

    const creds = await getOutlookCredentials();
    if (!creds) {
      return reply.type('text/html').send(oauthResultPage('error', 'not_configured'));
    }

    // Exchange authorization code for tokens
    const callbackUrl = `${getApiBaseUrl()}/outlook/callback`;
    const tokenResp = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
        scope: MS_SCOPES,
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text().catch(() => '');
      app.log.error(errText, 'Outlook token exchange failed');
      return reply.type('text/html').send(oauthResultPage('error', 'token_exchange'));
    }

    const tokenData = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      id_token?: string;
    };

    // Fetch user profile from MS Graph
    let externalEmail: string | null = null;
    let displayName: string | null = null;
    try {
      const profileResp = await fetch(`${MS_GRAPH_URL}/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (profileResp.ok) {
        const profile = await profileResp.json() as { mail?: string; userPrincipalName?: string; displayName?: string };
        externalEmail = profile.mail || profile.userPrincipalName || null;
        displayName = profile.displayName || null;
      }
    } catch { /* non-critical */ }

    // Upsert the UserIntegration row
    const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
    if (!integration) {
      return reply.type('text/html').send(oauthResultPage('error', 'no_integration'));
    }

    await prisma.userIntegration.upsert({
      where: {
        userId_integrationId: {
          userId: stateData.userId,
          integrationId: integration.id,
        },
      },
      create: {
        id: generateId('UserIntegration'),
        userId: stateData.userId,
        integrationId: integration.id,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        externalAccountId: externalEmail || stateData.userId,
        externalEmail,
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        externalAccountId: externalEmail || stateData.userId,
        externalEmail,
      },
    });

    // Also store the access token on the Integration row so notifications.ts can find it
    // This is the org-level "connected sender" account
    await prisma.integration.update({
      where: { provider: 'outlook' },
      data: { apiKey: encrypt(tokenData.access_token) },
    });

    await logAudit({
      actorId: stateData.userId,
      action: 'CREATE',
      objectType: 'UserIntegration',
      objectId: integration.id,
      objectName: 'Outlook',
      after: { externalEmail, displayName },
      ipAddress: extractIp(req),
    });

    reply.type('text/html').send(oauthResultPage('connected'));
  });

  // ── Connection status ──
  app.get('/outlook/status', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
      if (!integration || !integration.enabled) {
        return reply.send({ enabled: false, connected: false, configured: false });
      }

      let configured = false;
      if (integration.clientId && integration.clientSecret) {
        try {
          decrypt(integration.clientSecret);
          configured = true;
        } catch {
          configured = false;
        }
      }

      // Check for any connected user (the org sender)
      const conn = await prisma.userIntegration.findFirst({
        where: { integrationId: integration.id },
        orderBy: { connectedAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });

      let connected = false;
      if (conn?.accessToken) {
        try {
          decrypt(conn.accessToken);
          connected = true;
        } catch {
          connected = false;
        }
      }

      reply.send({
        enabled: true,
        configured,
        connected,
        externalEmail: connected ? (conn?.externalEmail ?? null) : null,
        connectedAt: connected ? (conn?.connectedAt ?? null) : null,
        connectedBy: connected ? (conn?.user?.name || conn?.user?.email || null) : null,
      });
    } catch (err: any) {
      req.log.error(err, 'GET /outlook/status failed');
      reply.send({ enabled: false, connected: false, configured: false });
    }
  });

  // ── Disconnect ──
  app.delete('/outlook/disconnect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });

    // Remove all user integrations (org-level sender disconnect)
    await prisma.userIntegration.deleteMany({
      where: { integrationId: integration.id },
    });

    // Clear the stored token on the Integration row
    await prisma.integration.update({
      where: { provider: 'outlook' },
      data: { apiKey: null },
    });

    await logAudit({
      actorId: user.sub,
      action: 'DELETE',
      objectType: 'UserIntegration',
      objectId: integration.id,
      objectName: 'Outlook',
      ipAddress: extractIp(req),
    });

    reply.code(204).send();
  });

  // ── Send test email ──
  app.post('/outlook/test-email', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const integration = await prisma.integration.findUnique({ where: { provider: 'outlook' } });
    if (!integration?.apiKey) {
      return reply.code(400).send({ error: 'Outlook is not connected. Please connect your Outlook account first.' });
    }

    let token: string;
    try {
      token = decrypt(integration.apiKey);
    } catch {
      return reply.code(400).send({ error: 'Outlook token is invalid. Please reconnect.' });
    }

    // Get a fresh token if needed
    const freshToken = await getValidOutlookToken(integration.id);
    if (!freshToken) {
      return reply.code(400).send({ error: 'Outlook token is expired. Please reconnect.' });
    }

    // Get the requester's email to send test to
    const sender = await prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, name: true } });
    if (!sender?.email) {
      return reply.code(400).send({ error: 'No email found for your account.' });
    }

    try {
      const res = await fetch(`${MS_GRAPH_URL}/me/sendMail`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: 'TischlerCRM - Outlook Connection Test',
            body: {
              contentType: 'HTML',
              content: `<p>Hello ${sender.name || sender.email},</p><p>This is a test email confirming your Outlook integration with TischlerCRM is working correctly.</p><p>You can now send invite emails and notifications through Outlook.</p>`,
            },
            toRecipients: [{ emailAddress: { address: sender.email } }],
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Graph sendMail failed: ${res.status} ${errText}`);
      }

      reply.send({ sent: true, message: `Test email sent to ${sender.email}` });
    } catch (err: any) {
      req.log.error(err, 'POST /outlook/test-email failed');
      reply.code(500).send({ error: `Failed to send test email: ${err.message}` });
    }
  });
}

// ── Token refresh helper (used by notifications.ts too) ──

export async function getValidOutlookToken(integrationId?: string): Promise<string | null> {
  try {
    const integration = integrationId
      ? await prisma.integration.findUnique({ where: { id: integrationId } })
      : await prisma.integration.findUnique({ where: { provider: 'outlook' } });
    if (!integration) return null;

    // Find the connected user's token
    const conn = await prisma.userIntegration.findFirst({
      where: { integrationId: integration.id },
      orderBy: { connectedAt: 'desc' },
    });
    if (!conn?.accessToken) {
      // Fall back to the token on the Integration row (legacy path)
      if (integration.apiKey) {
        try { return decrypt(integration.apiKey); } catch { return null; }
      }
      return null;
    }

    // Check if token is expired (with 5-min buffer)
    if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      if (!conn.refreshToken) return null;

      const creds = await getOutlookCredentials();
      if (!creds) return null;

      const refreshToken = decrypt(conn.refreshToken);
      const resp = await fetch(MS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: MS_SCOPES,
        }),
      });

      if (!resp.ok) return null;

      const data = await resp.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Update stored tokens
      await prisma.userIntegration.update({
        where: { id: conn.id },
        data: {
          accessToken: encrypt(data.access_token),
          refreshToken: data.refresh_token ? encrypt(data.refresh_token) : conn.refreshToken,
          tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      // Also update the org-level token
      await prisma.integration.update({
        where: { provider: 'outlook' },
        data: { apiKey: encrypt(data.access_token) },
      });

      return data.access_token;
    }

    return decrypt(conn.accessToken);
  } catch (err: any) {
    console.error('[outlook] Failed to get valid token:', err.message);
    return null;
  }
}
