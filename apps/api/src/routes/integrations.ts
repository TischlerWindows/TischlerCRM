/**
 * Integration management routes.
 *
 * Provides endpoints for:
 *  - Listing available integrations and their status
 *  - Enabling/disabling integrations (admin only)
 *  - Configuring org-level settings (API keys, client IDs)
 *  - Getting a specific integration's public config (for frontend use)
 *
 * OAuth connect/callback routes will be added per-provider as they're implemented.
 * Google Maps is the first — it only needs an API key, no OAuth.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { encrypt, encryptIfPresent } from '../crypto';
import { logAudit, extractIp } from '../audit';

// ── Provider registry ─────────────────────────────────────────────
// Defines which integrations the system knows about.  New providers
// are added here — the DB rows are seeded/upserted on first access.

interface ProviderDef {
  provider: string;
  displayName: string;
  description: string;
  category: string;
  authType: 'api_key' | 'oauth2';
  configSchema?: Record<string, any>; // describes the provider-specific config fields
}

const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    provider: 'google_maps',
    displayName: 'Google Maps',
    description: 'Geocode addresses and display interactive maps on account and contact records.',
    category: 'maps',
    authType: 'api_key',
  },
  {
    provider: 'dropbox',
    displayName: 'Dropbox',
    description: 'Attach and browse files from Dropbox on CRM records.',
    category: 'storage',
    authType: 'oauth2',
  },
  {
    provider: 'outlook',
    displayName: 'Microsoft Outlook',
    description: 'Sync calendars and optionally emails between Outlook and CRM.',
    category: 'calendar',
    authType: 'oauth2',
  },
];

/**
 * Ensure all known providers exist as rows in the Integration table.
 * Called once on route registration so the UI always sees every provider.
 */
async function seedProviders() {
  for (const def of PROVIDER_REGISTRY) {
    await prisma.integration.upsert({
      where: { provider: def.provider },
      create: {
        provider: def.provider,
        displayName: def.displayName,
        description: def.description,
        category: def.category,
        enabled: false,
        config: { authType: def.authType },
      },
      update: {
        // Update display metadata in case we change copy, but don't overwrite admin config
        displayName: def.displayName,
        description: def.description,
        category: def.category,
      },
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────

/** Strip encrypted secrets from an integration row before sending to the frontend. */
function sanitizeIntegration(row: any) {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    description: row.description,
    category: row.category,
    enabled: row.enabled,
    hasApiKey: !!row.apiKey,
    hasClientId: !!row.clientId,
    hasClientSecret: !!row.clientSecret,
    config: row.config,
    webhookUrl: row.webhookUrl,
    configuredById: row.configuredById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Routes ─────────────────────────────────────────────────────────

export async function integrationRoutes(app: FastifyInstance) {
  // Seed provider rows on startup
  await seedProviders();

  // ── List all integrations (any authenticated user) ──
  app.get('/integrations', async (_req, reply) => {
    try {
      const rows = await prisma.integration.findMany({
        orderBy: { displayName: 'asc' },
      });
      reply.send(rows.map(sanitizeIntegration));
    } catch (err: any) {
      app.log.error(err, 'GET /integrations failed');
      reply.code(500).send({ error: 'Failed to load integrations' });
    }
  });

  // ── User's connected integrations ──
  // IMPORTANT: registered BEFORE /:provider routes so "me" isn't treated as a provider name
  app.get('/integrations/me/connections', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const connections = await prisma.userIntegration.findMany({
        where: { userId: user.sub },
        include: {
          integration: {
            select: { provider: true, displayName: true, category: true, enabled: true },
          },
        },
        orderBy: { connectedAt: 'desc' },
      });

      // Strip tokens from the response
      reply.send(
        connections.map((c) => ({
          id: c.id,
          provider: c.integration.provider,
          displayName: c.integration.displayName,
          category: c.integration.category,
          integrationEnabled: c.integration.enabled,
          syncEnabled: c.syncEnabled,
          lastSyncAt: c.lastSyncAt,
          lastSyncStatus: c.lastSyncStatus,
          externalEmail: c.externalEmail,
          connectedAt: c.connectedAt,
        }))
      );
    } catch (err: any) {
      app.log.error(err, 'GET /integrations/me/connections failed');
      reply.code(500).send({ error: 'Failed to load connections' });
    }
  });

  // ── Get one integration's public config ──
  app.get('/integrations/:provider', async (req, reply) => {
    try {
      const { provider } = req.params as { provider: string };
      const row = await prisma.integration.findUnique({ where: { provider } });
      if (!row) return reply.code(404).send({ error: 'Integration not found' });
      reply.send(sanitizeIntegration(row));
    } catch (err: any) {
      app.log.error(err, 'GET /integrations/:provider failed');
      reply.code(500).send({ error: 'Failed to load integration' });
    }
  });

  // ── Configure an integration (admin only) ──
  // Handles enabling/disabling and setting credentials.
  app.put('/integrations/:provider', async (req, reply) => {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can configure integrations.' });
    }

    const { provider } = req.params as { provider: string };
    const bodySchema = z.object({
      enabled: z.boolean().optional(),
      apiKey: z.string().optional().nullable(),
      clientId: z.string().optional().nullable(),
      clientSecret: z.string().optional().nullable(),
      config: z.record(z.unknown()).optional(),
      webhookUrl: z.string().url().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    try {
      const existing = await prisma.integration.findUnique({ where: { provider } });
      if (!existing) return reply.code(404).send({ error: 'Integration not found' });

      const data: any = { configuredById: user.sub };

      if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
      if (parsed.data.webhookUrl !== undefined) data.webhookUrl = parsed.data.webhookUrl;

      // Encrypt secrets before storing
      if (parsed.data.apiKey !== undefined) {
        data.apiKey = encryptIfPresent(parsed.data.apiKey);
      }
      if (parsed.data.clientId !== undefined) {
        data.clientId = parsed.data.clientId; // Client IDs are public, no need to encrypt
      }
      if (parsed.data.clientSecret !== undefined) {
        data.clientSecret = encryptIfPresent(parsed.data.clientSecret);
      }

      // Merge config (provider-specific settings) with existing config
      if (parsed.data.config) {
        const existingConfig = (existing.config as Record<string, any>) || {};
        data.config = { ...existingConfig, ...parsed.data.config };
      }

      const updated = await prisma.integration.update({
        where: { provider },
        data,
      });

      await logAudit({
        actorId: user.sub,
        action: 'UPDATE',
        objectType: 'Integration',
        objectId: existing.id,
        objectName: existing.displayName,
        before: { enabled: existing.enabled, hasApiKey: !!existing.apiKey, hasClientSecret: !!existing.clientSecret },
        after: { enabled: updated.enabled, hasApiKey: !!updated.apiKey, hasClientSecret: !!updated.clientSecret },
        ipAddress: extractIp(req),
      });

      reply.send(sanitizeIntegration(updated));
    } catch (err: any) {
      app.log.error(err, 'PUT /integrations/:provider failed');
      reply.code(500).send({ error: 'Failed to update integration' });
    }
  });

  // ── Disable / reset an integration (admin only) ──
  app.delete('/integrations/:provider', async (req, reply) => {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can modify integrations.' });
    }

    const { provider } = req.params as { provider: string };
    try {
      const existing = await prisma.integration.findUnique({ where: { provider } });
      if (!existing) return reply.code(404).send({ error: 'Integration not found' });

      // Don't delete the row (we want it to stay in the UI) — just clear credentials
      await prisma.integration.update({
        where: { provider },
        data: {
          enabled: false,
          apiKey: null,
          clientId: null,
          clientSecret: null,
          webhookUrl: null,
          configuredById: user.sub,
        },
      });

      // Also disconnect all users from this integration
      await prisma.userIntegration.deleteMany({
        where: { integrationId: existing.id },
      });

      await logAudit({
        actorId: user.sub,
        action: 'DELETE',
        objectType: 'Integration',
        objectId: existing.id,
        objectName: existing.displayName,
        before: { enabled: existing.enabled, hasApiKey: !!existing.apiKey, hasClientSecret: !!existing.clientSecret },
        after: { enabled: false, hasApiKey: false, hasClientSecret: false },
        ipAddress: extractIp(req),
      });

      reply.code(204).send();
    } catch (err: any) {
      app.log.error(err, 'DELETE /integrations/:provider failed');
      reply.code(500).send({ error: 'Failed to reset integration' });
    }
  });

}
