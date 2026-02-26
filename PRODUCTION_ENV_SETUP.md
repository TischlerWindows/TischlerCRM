# Production Environment Setup Guide

## Overview

This guide covers setting up environment variables for cloud deployment. Never hardcode secrets in your code or commit them to git.

## Environment Variables Required

### Web App (Next.js)

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | URL | `https://api.yourdomain.com` |

**Note:** Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Keep other secrets server-side only.

### API (Fastify)

| Variable | Required | Format | Example |
|----------|----------|--------|---------|
| `DATABASE_URL` | Yes | PostgreSQL URI | `postgresql://user:pass@host:5432/crm` |
| `JWT_SECRET` | Yes | Random string (32+ chars) | (see generation below) |
| `APP_ENV` | Optional | `development` \| `production` | `production` |

## Generating JWT Secret

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) -replace "-"

# Node.js (cross-platform)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup (Cloud)

### Option 1: Railway (Recommended - Easiest)

1. Go to [railway.app](https://railway.app)
2. Create account and login
3. New Project → Add PostgreSQL
4. Copy the generated `DATABASE_URL`
5. Keep PostgreSQL private, only expose to API service

### Option 2: Render

1. Go to [render.com](https://render.com)
2. Create PostgreSQL database
3. Copy the external database URL
4. Format: `postgresql://user:password@host:5432/database`

### Option 3: AWS RDS

1. Create PostgreSQL database in AWS RDS
2. Get connection string from AWS console
3. Format: `postgresql://user:password@host:5432/database`

### Option 4: DigitalOcean Managed Database

1. Create PostgreSQL database cluster
2. Copy connection string
3. Format: `postgresql://user:password@host:5432/database`

## Deployment Platform Setup

### Railway (All-in-one)

1. **Connect GitHub:**
   - Push code to GitHub
   - Connect GitHub account in Railway

2. **Create Services:**
   - PostgreSQL: Automatically created
   - API: Link to `apps/api`, set build command to `pnpm build`
   - Web: Link to `apps/web`, set build command to `pnpm build`

3. **Set Environment Variables:**
   - Go to each service's Variables tab
   - Add `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL`

4. **Deploy:**
   - Railway auto-deploys on git push

### Vercel (Web) + Railway (API + DB)

1. **Deploy API to Railway:**
   - Connect GitHub repo
   - Select `apps/api` directory
   - Add environment variables
   - Deploy

2. **Deploy Web to Vercel:**
   - Import from GitHub
   - Set root directory: `apps/web`
   - Environment variables:
     - `NEXT_PUBLIC_API_URL` = Railway API URL
   - Deploy

### Fly.io (All services)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Launch PostgreSQL:**
   ```bash
   fly postgres create
   ```

3. **Deploy API:**
   ```bash
   cd apps/api
   fly launch
   fly secrets set DATABASE_URL="..." JWT_SECRET="..."
   fly deploy
   ```

4. **Deploy Web:**
   ```bash
   cd ../web
   fly launch
   fly secrets set NEXT_PUBLIC_API_URL="https://your-api.fly.dev"
   fly deploy
   ```

## Environment Variable Checklist

### Before Deploying to Production

- [ ] Generate a strong `JWT_SECRET` (32+ random characters)
- [ ] Set up cloud PostgreSQL database
- [ ] Verify `DATABASE_URL` is correct and accessible
- [ ] Set `NEXT_PUBLIC_API_URL` to production API URL
- [ ] Ensure `.env.local` and `.env.production` are NOT committed to git
- [ ] Add `.env*.local` to `.gitignore` (already done)
- [ ] Test database connection with `pnpm prisma db execute --stdin`

### Local Development

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000

# apps/api/.env
DATABASE_URL=postgresql://crm:crm@localhost:5432/crm?schema=public
JWT_SECRET=dev-secret-key-change-in-production
```

### Production

```bash
# apps/web/.env.production or Vercel/Railway dashboard
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# API service (Railway/Fly/Render)
DATABASE_URL=postgresql://user:password@cloud-host:5432/crm?schema=public
JWT_SECRET=<generated-32-char-string>
APP_ENV=production
```

## Testing Connection Before Deploy

```bash
# Test database connection
psql "postgresql://user:password@host:5432/database"

# Run migrations on cloud database
cd packages/db
DATABASE_URL="postgresql://user:password@host:5432/crm" pnpm prisma db push

# Seed production data (if needed)
DATABASE_URL="postgresql://user:password@host:5432/crm" pnpm prisma db seed
```

## Security Best Practices

1. **Never commit secrets** - Use platform-specific secret management
2. **Rotate JWT secret regularly** - Update in all services
3. **Use strong passwords** - For database user accounts
4. **Enable SSL/TLS** - For database connections
5. **Set CORS properly** - API should only accept requests from your domain
6. **Use HTTP-only cookies** - For session storage (not localStorage)
7. **Enable HTTPS** - Redirect all HTTP to HTTPS
8. **Set security headers** - HSTS, CSP, X-Frame-Options, etc.

## CORS Configuration for Production

Update `apps/api/src/app.ts` if needed:

```typescript
app.register(cors, {
  origin: process.env.APP_ENV === 'production' 
    ? 'https://yourdomain.com'  // Only allow your domain
    : true,                       // Allow all in development
  credentials: true,
});
```

## Troubleshooting

### "DATABASE_URL not set"
- Check `.env` file exists in `apps/api` directory
- Variables not loading? Restart the dev server
- Using Railway? Add in service Variables tab, not .env file

### "Cannot connect to database"
- Test connection manually: `psql "postgresql://..."`
- Check username/password
- Check firewall/security groups allow your IP
- Verify schema.public exists in database

### "JWT validation failed"
- Ensure `JWT_SECRET` is set in API service
- Same secret must be used for signing and verifying
- If you changed it, all existing tokens become invalid

### "API URL not found from web app"
- Verify `NEXT_PUBLIC_API_URL` is set
- Check it doesn't have trailing slash
- Verify CORS is enabled on API
- Check browser Network tab for actual request URL

## Next Steps

After environment setup:
1. [Push schema to cloud database](./POSTGRESQL_SETUP.md#cloud-database)
2. Deploy API service
3. Deploy web app with correct API URL
4. Test login flow end-to-end
5. Monitor logs for errors
