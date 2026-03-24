/**
 * Dropbox integration routes.
 *
 * Provides:
 *  - OAuth2 connect/callback flow (per-user)
 *  - File listing for a CRM record folder
 *  - File upload to a CRM record folder
 *  - Connection status check
 *  - Disconnect
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { encrypt, decrypt } from '../crypto';
import { logAudit, extractIp } from '../audit';

// ── Constants ──────────────────────────────────────────────────────

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_URL = 'https://content.dropboxapi.com/2';

const CRM_ROOT_FOLDER = '/TischlerCRM';

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

/** Build the record folder path inside Dropbox. */
function buildFolderPath(objectApiName: string, recordId: string): string {
  return `${CRM_ROOT_FOLDER}/${objectApiName}/${recordId}`;
}

/** Get the org-level Dropbox credentials (clientId, clientSecret). */
async function getDropboxCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
  if (!integration || !integration.enabled || !integration.clientId || !integration.clientSecret) {
    return null;
  }
  try {
    return {
      clientId: integration.clientId, // clientId is stored in plain text
      clientSecret: decrypt(integration.clientSecret),
    };
  } catch (err: any) {
    console.error('[dropbox] Failed to decrypt clientSecret:', err.message);
    return null;
  }
}

/** Get a valid access token for the user, refreshing if expired. */
async function getAccessToken(userId: string): Promise<string | null> {
  const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
  if (!integration) return null;

  const conn = await prisma.userIntegration.findFirst({
    where: { userId, integrationId: integration.id },
  });
  if (!conn || !conn.accessToken) return null;

  // Check if token is expired (with 5-min buffer)
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    // Refresh the token
    if (!conn.refreshToken) return null;
    const creds = await getDropboxCredentials();
    if (!creds) return null;

    const refreshToken = decrypt(conn.refreshToken);
    const resp = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as {
      access_token: string;
      expires_in: number;
    };

    await prisma.userIntegration.update({
      where: { id: conn.id },
      data: {
        accessToken: encrypt(data.access_token),
        tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token;
  }

  return decrypt(conn.accessToken);
}

/** Make an authenticated Dropbox API call. */
async function dropboxApi(
  accessToken: string,
  endpoint: string,
  body: Record<string, any>,
  isContent = false
): Promise<any> {
  const baseUrl = isContent ? DROPBOX_CONTENT_URL : DROPBOX_API_URL;
  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Dropbox API error ${resp.status}: ${errBody}`);
  }

  return resp.json();
}

// ── Routes ─────────────────────────────────────────────────────────

export async function dropboxRoutes(app: FastifyInstance) {

  // ── OAuth: Initiate Authorization ──
  // Returns the URL the frontend should redirect the user to.
  app.get('/dropbox/connect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const creds = await getDropboxCredentials();
      if (!creds) {
        return reply.code(400).send({ error: 'Dropbox integration is not configured. Ask an admin to set up the Client ID and Client Secret in Connected Apps.' });
      }

      // State parameter to prevent CSRF — encode userId + a random nonce
      const nonce = randomUUID();
      const state = Buffer.from(JSON.stringify({ userId: user.sub, nonce })).toString('base64url');

      const callbackUrl = `${getApiBaseUrl()}/dropbox/callback`;

      const params = new URLSearchParams({
        client_id: creds.clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        token_access_type: 'offline', // get a refresh_token
        state,
      });

      reply.send({ url: `${DROPBOX_AUTH_URL}?${params}` });
    } catch (err: any) {
      req.log.error(err, 'GET /dropbox/connect failed');
      reply.code(500).send({ error: 'Failed to start Dropbox authorization. Check server logs.' });
    }
  });

  // ── OAuth: Callback (code → tokens) ──
  app.get('/dropbox/callback', async (req, reply) => {
    const { code, state, error: oauthError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const frontendUrl = getFrontendUrl();

    if (oauthError || !code || !state) {
      return reply.redirect(`${frontendUrl}/settings/integrations?dropbox=error&reason=${oauthError || 'missing_code'}`);
    }

    // Decode state to get userId
    let stateData: { userId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return reply.redirect(`${frontendUrl}/settings/integrations?dropbox=error&reason=invalid_state`);
    }

    const creds = await getDropboxCredentials();
    if (!creds) {
      return reply.redirect(`${frontendUrl}/settings/integrations?dropbox=error&reason=not_configured`);
    }

    // Exchange authorization code for tokens
    const callbackUrl = `${getApiBaseUrl()}/dropbox/callback`;
    const tokenResp = await fetch(DROPBOX_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
    });

    if (!tokenResp.ok) {
      app.log.error(await tokenResp.text(), 'Dropbox token exchange failed');
      return reply.redirect(`${frontendUrl}/settings/integrations?dropbox=error&reason=token_exchange`);
    }

    const tokenData = await tokenResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      account_id: string;
      uid: string;
    };

    // Get the user's email from Dropbox
    let externalEmail: string | null = null;
    try {
      const acct = await dropboxApi(tokenData.access_token, '/users/get_current_account', {}) as {
        email?: string;
        name?: { display_name?: string };
      };
      externalEmail = acct.email ?? null;
    } catch { /* non-critical */ }

    // Upsert the UserIntegration row
    const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
    if (!integration) {
      return reply.redirect(`${frontendUrl}/settings/integrations?dropbox=error&reason=no_integration`);
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
        externalAccountId: tokenData.account_id,
        externalEmail,
      },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        externalAccountId: tokenData.account_id,
        externalEmail,
      },
    });

    await logAudit({
      actorId: stateData.userId,
      action: 'CREATE',
      objectType: 'UserIntegration',
      objectId: integration.id,
      objectName: 'Dropbox',
      after: { externalEmail, externalAccountId: tokenData.account_id },
      ipAddress: extractIp(req),
    });

    // Redirect back to the frontend with success
    reply.redirect(`${frontendUrl}/settings/integrations?dropbox=connected`);
  });

  // ── Connection status ──
  app.get('/dropbox/status', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
      if (!integration || !integration.enabled) {
        return reply.send({ enabled: false, connected: false, configured: false });
      }

      // Check credentials are present AND decryptable
      let configured = false;
      if (integration.clientId && integration.clientSecret) {
        try {
          decrypt(integration.clientSecret);
          configured = true;
        } catch {
          // Secret stored with a different key or in plaintext — treat as unconfigured
          configured = false;
        }
      }

      const conn = await prisma.userIntegration.findFirst({
        where: { userId: user.sub, integrationId: integration.id },
      });

      reply.send({
        enabled: true,
        configured,
        connected: !!conn,
        externalEmail: conn?.externalEmail ?? null,
        connectedAt: conn?.connectedAt ?? null,
      });
    } catch (err: any) {
      req.log.error(err, 'GET /dropbox/status failed');
      reply.send({ enabled: false, connected: false, configured: false });
    }
  });

  // ── Disconnect ──
  app.delete('/dropbox/disconnect', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const integration = await prisma.integration.findUnique({ where: { provider: 'dropbox' } });
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });

    await prisma.userIntegration.deleteMany({
      where: { userId: user.sub, integrationId: integration.id },
    });

    reply.code(204).send();
  });

  // ── List files in a record folder ──
  app.get('/dropbox/files/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) {
      return reply.send({ connected: false, files: [] });
    }

    const folderPath = buildFolderPath(objectApiName, recordId);

    try {
      const result = await dropboxApi(accessToken, '/files/list_folder', {
        path: folderPath,
        limit: 100,
        include_media_info: false,
      }) as {
        entries: Array<{
          '.tag': string;
          id: string;
          name: string;
          path_display: string;
          size?: number;
          server_modified?: string;
          client_modified?: string;
        }>;
      };

      const files = result.entries
        .filter(e => e['.tag'] === 'file')
        .map(e => ({
          id: e.id,
          name: e.name,
          path: e.path_display,
          size: e.size ?? 0,
          modifiedAt: e.server_modified ?? e.client_modified ?? null,
        }));

      reply.send({ connected: true, files });
    } catch (err: any) {
      // 409 path/not_found is normal — the folder doesn't exist yet
      if (err.message?.includes('409') || err.message?.includes('not_found')) {
        return reply.send({ connected: true, files: [] });
      }
      app.log.error(err, 'Dropbox list files failed');
      reply.code(500).send({ error: 'Failed to list files' });
    }
  });

  // ── Get temporary download link ──
  app.get('/dropbox/download/:fileId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { fileId } = req.params as { fileId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    try {
      const result = await dropboxApi(accessToken, '/files/get_temporary_link', {
        path: fileId, // Dropbox accepts file IDs as paths
      }) as { link: string };

      reply.send({ url: result.link });
    } catch (err: any) {
      app.log.error(err, 'Dropbox get download link failed');
      reply.code(500).send({ error: 'Failed to get download link' });
    }
  });

  // ── Upload file to record folder ──
  app.post('/dropbox/upload/:objectApiName/:recordId', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { objectApiName, recordId } = req.params as { objectApiName: string; recordId: string };
    const accessToken = await getAccessToken(user.sub);
    if (!accessToken) return reply.code(401).send({ error: 'Dropbox not connected' });

    // Read filename from query param, body comes as raw file content
    const fileName = (req.query as { fileName?: string }).fileName;
    if (!fileName) return reply.code(400).send({ error: 'fileName query parameter is required' });

    const folderPath = buildFolderPath(objectApiName, recordId);
    const filePath = `${folderPath}/${fileName}`;

    try {
      // Dropbox upload uses Dropbox-API-Arg header
      const body = await req.body;
      const resp = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: filePath,
            mode: 'add',        // don't overwrite existing files
            autorename: true,  // rename if a file with this name already exists
            mute: false,
          }),
        },
        body: body as any,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        app.log.error({ status: resp.status, body: errText }, 'Dropbox upload failed');
        return reply.code(500).send({ error: 'Upload failed' });
      }

      const result = await resp.json() as {
        id: string;
        name: string;
        path_display: string;
        size: number;
        server_modified: string;
      };

      reply.send({
        id: result.id,
        name: result.name,
        path: result.path_display,
        size: result.size,
        modifiedAt: result.server_modified,
      });
    } catch (err: any) {
      app.log.error(err, 'Dropbox upload error');
      reply.code(500).send({ error: 'Upload failed' });
    }
  });
}
