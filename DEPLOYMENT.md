# CRM Monorepo - Deployment Guide

## Architecture

This is a modern full-stack CRM built with:

```
┌─────────────────────────────────────────┐
│  Frontend (Next.js 14.2.5)              │
│  - React 18.2.0                         │
│  - Tailwind CSS                         │
│  - Zustand state management             │
│  - Dynamic form generation              │
└────────────────┬────────────────────────┘
                 │ API calls (recordsService)
                 │
┌────────────────▼────────────────────────┐
│  Backend (Fastify 4.27.0)               │
│  - RESTful API                          │
│  - JWT authentication                   │
│  - Role-based access control            │
└────────────────┬────────────────────────┘
                 │ Prisma ORM
                 │
┌────────────────▼────────────────────────┐
│  PostgreSQL Database                    │
│  - 10 core objects                      │
│  - Relationships & lookups              │
│  - Default page layouts                 │
└─────────────────────────────────────────┘
```

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- pnpm 9.0.0+
- PostgreSQL 13+

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local

# Setup database
pnpm exec tsx apps/api/seed-full.ts

# Start development servers
pnpm dev
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:4000
- Credentials: 
  - Admin: `admin@crm.local` / `admin123`
  - Demo: `test@example.com` / `password123`

## Production Deployment - Railway

### Option 1: Auto-Deploy via GitHub

1. **Connect Repository**
   - Go to https://railway.app
   - Create new project
   - Select "Deploy from GitHub"
   - Authorize and select repository

2. **Railway Auto-Detects Configuration**
   - Reads `railway.json` for service configuration
   - Builds and deploys automatically on push to `main`

3. **Configure Environment Variables**
   - Frontend: `NEXT_PUBLIC_API_URL` (your backend URL)
   - Backend: `DATABASE_URL`, `JWT_SECRET`
   - See [Railway Dashboard](https://railway.app/dashboard)

4. **Run Migrations**
   - Open Railway Shell for backend
   - Run: `pnpm exec prisma db push`
   - Seed: `pnpm exec tsx apps/api/seed-full.ts`

### Option 2: Manual Railway CLI Deployment

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs
```

### Environment Variables (Production)

**Frontend (Next.js)**
```
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NODE_ENV=production
```

**Backend (Fastify)**
```
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=generate-secure-random-string
NODE_ENV=production
PORT=4000
```

**Database (Auto-provisioned by Railway)**
- PostgreSQL 13+
- 10GB storage included

## Cost Estimation

| Service | Monthly Cost | Details |
|---------|-------------|---------|
| Next.js Frontend | $5-10 | 1 GB RAM, auto-scaling |
| Fastify Backend | $5-10 | 1 GB RAM, auto-scaling |
| PostgreSQL | $15-20 | 10GB included, $1/GB overage |
| **Total** | **$25-40** | Conservative estimate |

*Pricing as of Feb 2026. See https://railway.app/pricing*

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed and merged to `main`
- [ ] Environment variables documented
- [ ] Database migrations tested locally
- [ ] API endpoints tested with Postman/curl

### Deployment
- [ ] GitHub repository connected to Railway
- [ ] `railway.json` present in root
- [ ] Build completes successfully
- [ ] Services starting without errors
- [ ] Database initialized and seeded

### Post-Deployment
- [ ] Frontend accessible at custom domain
- [ ] Login works with test credentials
- [ ] API responds to authenticated requests
- [ ] Database queries working
- [ ] Logs show no critical errors
- [ ] Performance metrics acceptable

## Monitoring & Maintenance

### View Logs
```bash
# Railway CLI
railway logs --service backend
railway logs --service frontend

# Tail logs
railway logs -f
```

### Database Backups

Railway provides daily backups automatically. To restore:
1. Go to Railway Dashboard
2. Select database service
3. View backups and restore if needed

### Performance Monitoring

Railway provides built-in metrics:
1. CPU usage
2. Memory usage
3. Response times
4. Error rates

Monitor in Dashboard → Deployments → Metrics

## Troubleshooting

### Build Fails
```
Error: "pnpm not found"
```
- Ensure `pnpm-lock.yaml` in root
- Railway auto-detects Node.js project

### API Connection Error
```
Error: "Failed to fetch"
```
- Check `NEXT_PUBLIC_API_URL` in Railway
- Must include full domain: `https://your-api.railway.app`
- Verify CORS enabled in backend

### Database Connection Error
```
Error: "ECONNREFUSED"
```
- DATABASE_URL might not be set
- Check Railway dashboard for DATABASE_URL
- Wait 2-3 minutes for Database to start

### Out of Memory
```
Error: "JavaScript heap out of memory"
```
- Increase RAM in Railway (Plan settings)
- Check for memory leaks in code
- Contact Railway support if issue persists

## API Reference

### Authentication

**Login**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response: { "token": "jwt-token" }
```

**All requests require Authorization header**
```bash
Authorization: Bearer <jwt-token>
```

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/objects` | List all objects |
| GET | `/api/records/:object` | Get records for object |
| GET | `/api/records/:object/:id` | Get single record |
| POST | `/api/records/:object` | Create record |
| PUT | `/api/records/:object/:id` | Update record |
| DELETE | `/api/records/:object/:id` | Delete record |

### Example: Get Properties

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-api.railway.app/api/records/Property
```

## Configuration Files

- **`railway.json`** - Railway deployment configuration
- **`.env.example`** - Local development environment template
- **`.env.production.local`** - Production environment variables
- **`package.json`** - Build and start scripts
- **`.github/workflows/ci-cd.yml`** - GitHub Actions CI/CD

## Database Schema

### Core Objects
1. **Property** - Real estate listings
2. **Contact** - People records
3. **Account** - Organizations
4. **Lead** - Sales opportunities
5. **Deal** - Active opportunities
6. **Project** - Major initiatives
7. **Product** - Products/services
8. **Quote** - Quotations
9. **Service** - Service requests
10. **Installation** - Installation records

Each object has:
- Custom fields (configurable)
- Page layouts (for display)
- Record types (for variants)
- Relationships (to other objects)
- Audit fields (createdBy, createdAt, etc.)

## Support & Resources

- **Documentation**: https://docs.railway.app
- **Community**: https://chat.railway.app
- **Status**: https://status.railway.app
- **GitHub**: https://github.com/alexandroumichael3/TCES

## License

Proprietary - All rights reserved
