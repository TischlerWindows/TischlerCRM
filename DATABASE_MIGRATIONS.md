# Database Migration Deployment Guide

## Overview

Prisma migrations allow you to safely version and deploy database schema changes. This guide covers deploying migrations to cloud databases.

## Local Migration Status

✅ **Already Applied Locally:**
- All migrations from `packages/db/prisma/migrations/` have been applied
- Schema is synced to local PostgreSQL database
- Latest migration: `add_dashboards`

## Cloud Database Migration

### Before Running Migrations

1. **Cloud database must exist** with empty or compatible schema
2. **DATABASE_URL must be set** in environment
3. **Prisma CLI needs access** to the database

### Step 1: Generate Migrations (Already Done ✓)

We've created migration files in:
```
packages/db/prisma/migrations/
├── add_reports/
│   └── migration.sql
└── add_dashboards/
    └── migration.sql
```

These migration files are now part of your repo and can be deployed anywhere.

### Step 2: Deploy Migrations to Cloud

#### Option A: Railway

1. **Set DATABASE_URL in Railway:**
   - Go to API service → Variables
   - Add `DATABASE_URL` from PostgreSQL service

2. **Run migrations on deploy:**
   
   Add to `apps/api/package.json` build command:
   ```json
   {
     "scripts": {
       "build": "pnpm prisma migrate deploy && pnpm build",
       "start": "node dist/server.js"
     }
   }
   ```

3. **Deploy:**
   ```bash
   git push  # Railway auto-deploys
   ```

#### Option B: Vercel (API endpoint)

1. **Set DATABASE_URL:**
   - Vercel Project Settings → Environment Variables
   - Add `DATABASE_URL` (set for all environments)

2. **Create deploy hook:**
   ```bash
   vercel env add DATABASE_URL
   ```

3. **Update build command:**
   ```json
   {
     "buildCommand": "pnpm prisma migrate deploy && pnpm build"
   }
   ```

#### Option C: Fly.io

1. **Set DATABASE_URL as secret:**
   ```bash
   fly secrets set DATABASE_URL="postgresql://user:password@your-postgres.fly.dev/crm"
   ```

2. **Update Dockerfile (if custom):**
   ```dockerfile
   RUN DATABASE_URL=$DATABASE_URL pnpm prisma migrate deploy
   ```

3. **Deploy:**
   ```bash
   fly deploy
   ```

#### Option D: Self-Hosted / Docker

1. **Create `.env` file with DATABASE_URL:**
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/crm"
   ```

2. **Run migration before starting app:**
   ```bash
   cd packages/db
   DATABASE_URL="your-connection-string" pnpm prisma migrate deploy
   ```

3. **Then start your app:**
   ```bash
   cd apps/api
   npm start
   ```

### Step 3: Verify Migrations Applied

After deployment, verify migrations were applied:

```bash
# Option 1: Check database directly
psql "postgresql://user:password@host:5432/crm" -c "\dt"

# Option 2: Check Prisma migration history
DATABASE_URL="your-connection-string" pnpm prisma migrate status
```

Expected output for `migrate status`:
```
Following migrations have not yet been applied:
  └─ (No pending migrations)

Migrations that have been applied:
  └─ add_reports
  └─ add_dashboards
```

## Migration Commands Reference

### Local Development

```bash
# View migration status
cd packages/db
pnpm prisma migrate status

# Create new migration from schema changes
pnpm prisma migrate dev --name my_feature

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# Resolve migration conflicts
pnpm prisma migrate resolve --rolled-back migration_name
```

### Production Deployment

```bash
# Apply pending migrations (use this in CI/CD)
pnpm prisma migrate deploy

# Check what migrations will be applied
pnpm prisma migrate status

# Verify database is in sync with schema
pnpm prisma db execute --stdin < check.sql
```

## Handling Migration Failures

### "Migration failed" Error

1. **Check the error message** - identifies which migration failed
2. **Review migration SQL** in `packages/db/prisma/migrations/[name]/migration.sql`
3. **Fix database state:**
   - If migration is partially applied, manually roll back
   - Rerun `prisma migrate deploy`

### "Cannot create shadow database" Error

This error occurs on local dev but shouldn't happen in production. It means:
- Database user doesn't have CREATE DATABASE permission
- Solution: Use `prisma db push` instead of `migrate dev`

### "Foreign key constraint failed" Error

Migrations failed because of constraint conflicts:
1. **Check migration order** - migrations must run in order
2. **Check schema relationships** - ensure Parent records exist before Child records
3. **Verify data types match** - referenced columns must have same type

### "Column not found" Error

Likely causes:
- Migration not applied completely
- Database version mismatch
- Concurrent migrations running

Solution:
```bash
# Check status
pnpm prisma migrate status

# Force status (use carefully)
pnpm prisma migrate resolve --rolled-back migration_name
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy with Migrations

on:
  push:
    branches: [main]

jobs:
  migrate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run database migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd packages/db
          pnpm prisma migrate deploy
      
      - name: Deploy application
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          # Your deployment command here
          pnpm build && pnpm deploy
```

## Best Practices

### Before Creating Migrations

1. **Test locally first:**
   ```bash
   pnpm prisma migrate dev --name my_feature
   ```

2. **Review migration SQL:**
   ```bash
   cat packages/db/prisma/migrations/my_feature/migration.sql
   ```

3. **Verify with data:**
   ```bash
   pnpm prisma db seed  # Populate test data
   ```

### During Deployment

1. **Always run migrations before starting app**
   - Include in build step, not runtime
   - Prevents race conditions with multiple instances

2. **Monitor migration execution:**
   - Log migration start/end times
   - Alert on failures
   - Keep database backups

3. **Plan for rollbacks:**
   - Keep previous app version available
   - Test rollback migrations locally first
   - Document manual rollback steps

### After Deployment

1. **Verify in production:**
   ```bash
   # SSH into production environment
   psql $DATABASE_URL -c "SELECT * FROM \"_prisma_migrations\" ORDER BY finished_at DESC LIMIT 5;"
   ```

2. **Monitor for issues:**
   - Check app logs for migration errors
   - Monitor database performance
   - Verify data integrity

3. **Clean up:**
   - Remove old migration files if consolidated
   - Document any manual changes made
   - Update team on schema changes

## Useful Commands

| Command | Purpose |
|---------|---------|
| `pnpm prisma migrate status` | Show pending migrations |
| `pnpm prisma migrate deploy` | Apply all pending migrations (production) |
| `pnpm prisma migrate dev --name X` | Create new migration (development) |
| `pnpm prisma migrate reset` | Reset database to initial state (development only) |
| `pnpm prisma db push` | Sync schema without migrations (quick local dev) |
| `pnpm prisma db seed` | Run seed script to populate test data |
| `pnpm prisma studio` | Open web UI to browse database |

## Troubleshooting Checklist

- [ ] DATABASE_URL is set and correct
- [ ] Database server is accessible and running
- [ ] Database user has necessary permissions
- [ ] All previous migrations were applied successfully
- [ ] No concurrent migrations running
- [ ] Enough disk space on database server
- [ ] Network connectivity to database is stable
- [ ] Review Prisma docs for your database version

## Next Steps

1. ✅ Migrations created and tested locally
2. Set up cloud PostgreSQL database
3. Configure DATABASE_URL in deployment platform
4. Add migration step to build/deploy process
5. Deploy and verify migrations applied
6. Monitor production database for issues

## See Also

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Deployment Guides](./PRODUCTION_ENV_SETUP.md)
- [Environment Variables](./ENV_SETUP_CHECKLIST.md)
