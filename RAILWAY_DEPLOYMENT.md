# Railway Deployment Guide

## Quick Start

This guide walks through deploying the CRM monorepo to Railway.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository access
- PostgreSQL database (managed by Railway)

## Deployment Steps

### 1. Connect GitHub to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize Railway to access your GitHub account
5. Select the repository: `TCES` or `crm-monorepo`
6. Select branch: `main`

### 2. Configure Services

Your `railway.json` automatically creates:
- **Frontend** (Next.js on port 3000)
- **Backend** (Fastify API on port 4000)
- **Database** (PostgreSQL)

### 3. Set Environment Variables

#### Frontend Service (Next.js)
```
NEXT_PUBLIC_API_URL=https://your-api-{railwayId}.railway.app
NODE_ENV=production
```

#### Backend Service (Fastify API)
```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
JWT_SECRET=your-secret-key-here (generate randomly)
NODE_ENV=production
PORT=4000
```

#### Database (PostgreSQL)
Railway automatically configures:
- `DATABASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

### 4. Run Database Migrations

After deployment:

1. Connect to Railway Shell for the Backend service
2. Run migrations:
   ```bash
   pnpm prisma db push
   pnpm exec tsx apps/api/seed-full.ts
   ```

### 5. Configure Custom Domains (Optional)

1. In Railway dashboard, select your service
2. Go to "Settings"
3. Add your custom domain (e.g., `crm.yourdomain.com`)
4. Update your DNS records accordingly

## Environment Variables Reference

### Next.js Frontend

| Variable | Value | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_API_URL` | Your Railway API URL | ✓ |
| `NODE_ENV` | production | ✓ |

### Fastify Backend

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✓ |
| `JWT_SECRET` | Random secret key (32+ chars) | ✓ |
| `NODE_ENV` | production | ✓ |
| `PORT` | 4000 | ✓ |

### PostgreSQL (Auto-configured)

No manual configuration needed. Railway auto-sets:
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

## Deployment Checklist

- [ ] GitHub repository connected
- [ ] `railway.json` present in repo root
- [ ] Environment variables configured in Railway dashboard
- [ ] Database URL set correctly
- [ ] JWT_SECRET configured
- [ ] API_URL in frontend points to backend service
- [ ] Migrations run successfully
- [ ] Database seeded with base data
- [ ] Login works (admin@crm.local / admin123 OR test@example.com / password123)
- [ ] All pages load and fetch data

## Troubleshooting

### Build Fails

**Error: `pnpm not found`**
- Railway uses Nixpacks which auto-detects pnpm
- Ensure `pnpm-lock.yaml` is in repo root

**Error: `Port already in use`**
- Railway will auto-assign ports
- Remove hardcoded port numbers from start scripts

### API Connection Issues

**Error: `Failed to fetch from API`**
- Check `NEXT_PUBLIC_API_URL` in Railway dashboard
- Should be the Railway backend service URL
- Example: `https://crm-api-xxxx.railway.app`

**Error: `DATABASE_URL not set`**
- Ensure Database service is linked to Backend service
- Check Railway dashboard for DATABASE_URL variable

### Database Issues

**Error: `ECONNREFUSED`**
- Database might not be running
- Wait 30 seconds and retry
- Check Railway dashboard for errors

**Error: `No migration lock acquired`**
- Multiple migrations running simultaneously
- Wait for other migration to complete

## Cost Estimation

**Railway Pricing (as of Feb 2026):**
- **Next.js**: ~$5-10/month (1 GB RAM)
- **Fastify API**: ~$5-10/month (1 GB RAM)
- **PostgreSQL**: ~$15/month (10 GB storage)
- **Total**: ~$25-35/month

*Pricing varies with usage. See https://railway.app/pricing for details.*

## Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Railway Documentation: https://docs.railway.app
- GitHub Integration: https://docs.railway.app/deploy/github
- Custom Domains: https://docs.railway.app/deploy/expose-your-app

## Next Steps

1. Push changes to GitHub
2. Connect repository to Railway
3. Configure environment variables
4. Deploy services
5. Run migrations and seed data
6. Test application
7. Configure monitoring and alerts (optional)

## Support

For Railway support issues:
- Docs: https://docs.railway.app
- Community: https://chat.railway.app
- Status: https://status.railway.app
