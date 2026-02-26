# Local Database Setup Guide

## Prerequisites

You need **PostgreSQL 15+** installed locally. If you don't have it, follow Option A below. If you already have PostgreSQL running, skip to the setup section.

## Option A: Install PostgreSQL (One-time)

1. **Download PostgreSQL**: https://www.postgresql.org/download/windows/
2. **Run the installer**. When prompted:
   - **Password**: `crm`
   - **Port**: `5432`
   - Accept defaults for other options
3. **Finish installation** and PostgreSQL will start automatically

## Option B: Verify PostgreSQL is Running

If you already have PostgreSQL installed:

1. Open Services (services.msc) or Task Manager
2. Look for "postgresql-x64-15" service
3. If not running, start it

## Setup Steps

### 1. Create Environment Files

Run this PowerShell command from the repo root:

```powershell
.\setup-local-db.ps1
```

Or manually create these files:

**File: `packages/db/.env`**
```
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
```

**File: `apps/api/.env`**
```
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
JWT_SECRET="dev-secret-key-change-in-production"
```

### 2. Create the Database & User

Connect to PostgreSQL as admin (replace `postgres` user if you used different):

```powershell
# You may need to provide password when prompted
sqlcmd -S localhost -U postgres -Q "CREATE LOGIN crm WITH PASSWORD = 'crm';"
sqlcmd -S localhost -U postgres -Q "CREATE DATABASE crm OWNER crm;"
```

Or using psql if available:
```powershell
psql -U postgres
```

Then in the psql prompt:
```sql
CREATE USER crm WITH PASSWORD 'crm';
CREATE DATABASE crm OWNER crm;
\q
```

### 3. Push Schema & Seed Data

From repo root:

```powershell
# Generate Prisma client
cd packages\db
pnpm prisma:push

# Go back to root
cd ..\..

# Seed demo users and data
cd apps\api
pnpm run seed
```

You should see:
```
✅ Created admin user: admin@crm.local
✅ Created demo user: test@example.com
✅ Created Property object
✅ Created Account object
...
```

### 4. Start Development Servers

**Terminal 1 - API Server**
```powershell
cd apps\api
pnpm dev
```

Should output: `API listening on 4000`

**Terminal 2 - Web App**
```powershell
cd apps\web
pnpm dev
```

Should output: `▲ Next.js 15... Local: http://localhost:3000`

### 5. Test Login

Go to: http://localhost:3000/login

Use these credentials:
- **Email**: `test@example.com`
- **Password**: `password123`

## Troubleshooting

### Can't connect to PostgreSQL
```powershell
# Check if service is running
Get-Service | Where-Object {$_.Name -like "*postgres*"}

# Start the service
Start-Service -Name "postgresql-x64-15"
```

### Database already exists
If you get "database already exists" error:
```powershell
psql -U postgres
DROP DATABASE IF EXISTS crm;
DROP USER IF EXISTS crm;
CREATE USER crm WITH PASSWORD 'crm';
CREATE DATABASE crm OWNER crm;
\q
```

### Prisma migrate errors
Clear and retry:
```powershell
cd packages\db
pnpm exec prisma migrate reset
pnpm prisma:push
```

## Later: Upload to Cloud

When ready, export this database:

```powershell
pg_dump -U crm crm > crm-backup.sql
```

Then import to cloud PostgreSQL (Supabase, Railway, AWS RDS, etc.)

