# Quick Migration Deployment Guide

## TL;DR - Minimal Steps

### Railway (Easiest)

```bash
# 1. Add DATABASE_URL to API service variables
# 2. Update apps/api/package.json:
{
  "scripts": {
    "build": "pnpm prisma migrate deploy && pnpm build"
  }
}

# 3. Push to GitHub - Railway auto-deploys with migrations
git add apps/api/package.json
git commit -m "Run migrations on deploy"
git push
```

### Vercel + Railway API

```bash
# 1. Deploy API to Railway with build script (see Railway above)

# 2. On Vercel dashboard, set environment variable:
NEXT_PUBLIC_API_URL = https://your-api.railway.app

# 3. Deploy web app
vercel --prod
```

### Fly.io

```bash
# 1. Create PostgreSQL
fly postgres create

# 2. Set DATABASE_URL secret
fly secrets set DATABASE_URL="postgresql://user:password@host/crm"

# 3. Add to Dockerfile or build script:
# RUN cd packages/db && DATABASE_URL=$DATABASE_URL pnpm prisma migrate deploy

# 4. Deploy
fly deploy
```

## Step-by-Step for Each Platform

### Railway

1. **In Railway Dashboard:**
   - Go to API service
   - Variables tab
   - Add `DATABASE_URL` (copy from PostgreSQL service)

2. **Update build command:**
   ```json
   // apps/api/package.json
   {
     "scripts": {
       "build": "pnpm i && pnpm prisma migrate deploy && pnpm build"
     }
   }
   ```

3. **Deploy:**
   ```bash
   git push
   # Railway auto-deploys on push
   ```

### Vercel (Next.js) + Railway (API + DB)

1. **Deploy API first (to Railway)** - see Railway section above

2. **Deploy Web:**
   ```bash
   # Option A: Via Vercel CLI
   cd apps/web
   vercel --prod
   
   # Option B: Via GitHub
   # - Push to GitHub
   # - Import in Vercel dashboard
   # - Set NEXT_PUBLIC_API_URL environment variable
   # - Auto-deploys on push
   ```

3. **Environment Variables in Vercel:**
   - Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_URL` = `https://your-api.railway.app`

### Fly.io

1. **Setup PostgreSQL:**
   ```bash
   fly postgres create --name crm-db
   # Copy the connection string
   ```

2. **Deploy API:**
   ```bash
   cd apps/api
   fly launch
   
   # When prompted:
   # - Name: crm-api
   # - Database: Link to crm-db created above
   
   # Set secrets
   fly secrets set DATABASE_URL="postgresql://..."
   fly secrets set JWT_SECRET="your-generated-secret"
   
   # Deploy
   fly deploy
   ```

3. **Deploy Web:**
   ```bash
   cd ../web
   fly launch
   
   # When prompted:
   # - Name: crm-web
   # - No database needed
   
   # Set environment variable
   fly secrets set NEXT_PUBLIC_API_URL="https://crm-api.fly.dev"
   
   fly deploy
   ```

### Self-Hosted / Docker

1. **Set DATABASE_URL:**
   ```bash
   export DATABASE_URL="postgresql://user:password@host:5432/crm"
   ```

2. **Run migrations:**
   ```bash
   cd packages/db
   pnpm prisma migrate deploy
   ```

3. **Start application:**
   ```bash
   cd ../../apps/api
   npm start
   ```

## Verification Commands

After deployment, verify migrations applied:

```bash
# Check migration status
pnpm prisma migrate status

# List applied migrations
psql $DATABASE_URL -c "SELECT * FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 10;"

# Verify tables exist
psql $DATABASE_URL -c "\dt"
# Should show: Dashboard, DashboardWidget, and all other tables
```

## Troubleshooting

### "Cannot connect to database"
```bash
# Test connection
psql "postgresql://user:password@host:5432/crm" -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

### "Migration failed"
```bash
# Check which migration failed
pnpm prisma migrate status

# View migration SQL
cat packages/db/prisma/migrations/[migration_name]/migration.sql

# Try again
pnpm prisma migrate deploy
```

### "Insufficient permissions"
- Database user needs CREATE, ALTER, DROP privileges on schema
- Contact database provider or admin

### "Migrations already applied"
```bash
# Reset and try again (WARNING: deletes data)
pnpm prisma migrate reset

# Or just check status
pnpm prisma migrate status
```

## Using Migration Scripts

### Linux/Mac
```bash
./scripts/deploy-migrations.sh "postgresql://user:password@host:5432/crm"
```

### Windows PowerShell
```powershell
.\scripts\deploy-migrations.ps1 -DatabaseUrl "postgresql://user:password@host:5432/crm"
```

## Safety Checklist

Before running migrations on production:

- [ ] Backup your database
- [ ] Verify DATABASE_URL is correct
- [ ] Test migrations on staging first
- [ ] Check `pnpm prisma migrate status` output
- [ ] Read migration SQL to understand changes
- [ ] Have rollback plan ready
- [ ] Monitor database logs during migration
- [ ] Test application after migrations applied

## Migration Timeline

1. **Create migration** (already done):
   ```bash
   pnpm prisma migrate dev --name feature_name
   ```

2. **Test locally:**
   ```bash
   pnpm prisma migrate status
   ```

3. **Commit migration files:**
   ```bash
   git add packages/db/prisma/migrations/
   git commit -m "feat: add [feature] migration"
   ```

4. **Deploy to staging:**
   - Set DATABASE_URL for staging
   - Run: `pnpm prisma migrate deploy`
   - Test application

5. **Deploy to production:**
   - Set DATABASE_URL for production
   - Run: `pnpm prisma migrate deploy`
   - Monitor logs and database health

## Next Steps

1. ✅ Migrations created and tested locally
2. Set up cloud PostgreSQL database
3. Configure DATABASE_URL in your platform
4. Run migrations: `pnpm prisma migrate deploy`
5. Verify: `pnpm prisma migrate status`
6. Deploy application

See: [DATABASE_MIGRATIONS.md](./DATABASE_MIGRATIONS.md) for complete reference
