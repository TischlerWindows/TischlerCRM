# Integration Backbone

## What Was Built

A complete infrastructure layer for managing external API integrations (Google Maps, Dropbox, Outlook) through the Settings UI. No integrations are actively _used_ yet — this is the backbone only. API keys are stored encrypted, never hardcoded, never in `.env`.

---

## Files

### `apps/api/src/crypto.ts`
AES-256-GCM encryption utility for securing API keys and OAuth tokens at rest. Uses `ENCRYPTION_KEY` env var (64-char hex string). Falls back to a SHA-256 hash of `JWT_SECRET` in dev. Each encryption produces a unique IV.

### `apps/api/src/routes/integrations.ts`
Fastify route group at `/integrations/*`. On startup, seeds three provider rows into the DB (google_maps, dropbox, outlook). Routes:

- `GET /integrations` — list all integrations with sanitized config (no raw secrets)
- `GET /integrations/me/connections` — current user's OAuth connections (registered before `:provider` routes to avoid param collision)
- `GET /integrations/:provider` — single integration's public config
- `PUT /integrations/:provider` — admin-only: enable/disable, set API key or OAuth credentials (encrypted before storage)
- `DELETE /integrations/:provider` — admin-only: clears credentials, disconnects all users, keeps the row

### `apps/web/app/settings/integrations/page.tsx`
"Connected Apps" settings page. Shows a card per provider with Active/Inactive badge. Each card has an expandable config panel with:
- Enable/disable toggle
- API key input (masked) for `api_key` type integrations (Google Maps)
- Client ID + Client Secret inputs for `oauth2` type integrations (Dropbox, Outlook)
- Reset button that clears credentials and disconnects users
- Links to provider docs

---

## Schema

### `Integration` table
Org-level config: provider name (unique), display metadata, category, enabled flag, encrypted apiKey/clientId/clientSecret, JSON config, webhook URL, audit fields. Relations to User (configuredBy) and UserIntegration.

### `UserIntegration` table
Per-user OAuth state: encrypted access/refresh tokens, token expiry, scopes, sync state (enabled, lastSyncAt, status, error, cursor), external account info. Unique on (userId, integrationId).

---

## How It Works End-to-End

1. API boots → `integrationRoutes` seeds google_maps, dropbox, outlook rows in `Integration` table
2. Admin goes to Settings → Connected Apps → sees three cards (all Inactive)
3. Admin clicks Configure on Google Maps → pastes API key → toggles Enabled → Save
4. Backend encrypts the key with AES-256-GCM and stores the ciphertext in `Integration.apiKey`
5. Frontend only sees `hasApiKey: true` — never the raw key
6. When a feature route needs the key, it reads directly from the DB and decrypts in-process (see pattern below)

---

## How to Add a New Integration

### Step 1: Register the provider

Add an entry to `PROVIDER_REGISTRY` in `apps/api/src/routes/integrations.ts`:

```ts
{
  provider: 'sendgrid',
  displayName: 'SendGrid',
  description: 'Send transactional emails from CRM records.',
  category: 'email',
  authType: 'api_key',
},
```

The DB row is seeded automatically on next boot. The Settings UI picks it up immediately.

### Step 2: Build the feature route

Create `apps/api/src/routes/<feature>.ts`. Read the stored key directly from the DB — **do not call an HTTP endpoint to get it**:

```ts
import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { decrypt } from '../crypto';

export async function sendgridRoutes(app: FastifyInstance) {
  app.post('/emails/send', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    // Read and decrypt the key server-side — the raw key never leaves this process
    const integration = await prisma.integration.findUnique({
      where: { provider: 'sendgrid' },
    });
    if (!integration?.enabled || !integration.apiKey) {
      return reply.code(400).send({ error: 'SendGrid integration is not configured' });
    }
    const apiKey = decrypt(integration.apiKey);

    // Use apiKey for the outbound API call
    // ...
  });
}
```

### Step 3: Register the route

Add to `apps/api/src/app.ts`:

```ts
import { sendgridRoutes } from './routes/sendgrid';
// ...
app.register(sendgridRoutes);
```

### Step 4: Add frontend API client methods (if needed)

Add the relevant methods to `apps/web/lib/api-client.ts` for your feature's endpoints (e.g. `POST /emails/send`). Never add a method that fetches a raw credential.

---

## Security Principles

- Raw API keys and OAuth tokens are **never returned to the frontend**
- The `/integrations/:provider` endpoint only exposes `hasApiKey: boolean`, not the key value
- Credentials are encrypted at rest with AES-256-GCM; each write produces a unique IV
- Feature route handlers access credentials via `prisma + decrypt` in-process — no HTTP round-trip, no extra exposure surface
- Admin-only routes (PUT, DELETE) require `user.role === 'ADMIN'`

---

## Migration Required

Run the migration locally against your Railway database using the private connection string:

```bash
cd packages/db
DATABASE_URL="<your Railway DATABASE_URL>" npx prisma migrate deploy --name add_integration_tables
```

Or push schema changes directly (for development environments):

```bash
cd packages/db
DATABASE_URL="<your Railway DATABASE_URL>" npx prisma db push
```

Get the connection string from the Railway dashboard: your Postgres service → **Connect** tab → **Database URL**. Use the private URL (`DATABASE_PRIVATE_URL`) when running commands from within Railway's network, or the public URL when running from your local machine.

### Set ENCRYPTION_KEY on Railway

Generate a dedicated encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then set it as a Railway variable — **seal it** so the value is irreversible and invisible in the UI:

```bash
railway variables set ENCRYPTION_KEY=<output>
```

Or set it through the Railway dashboard: your service → **Variables** → Add → mark as **Sealed**. Never commit this value to git or put it in `.env.production`.

---

## Next Steps

- **Google Maps geocoding**: Create `apps/api/src/routes/geocode.ts` (GET /geocode?address=...) following the pattern above, add `apiClient.geocode()` to the web client, render a map component on record detail pages for Address fields.
- **Outlook Calendar Sync**: Implement OAuth 2.0 connect/callback routes using Microsoft Graph API, build a sync worker.
- **Dropbox**: Implement OAuth + Dropbox SDK calls in `apps/api/src/routes/dropbox.ts`.
