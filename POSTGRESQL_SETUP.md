# PostgreSQL Setup Instructions

Since Docker is not available on this system, you have a few options to run PostgreSQL:

## Option 1: Install PostgreSQL Locally (Recommended)

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install with these settings:
   - Username: `crm`
   - Password: `crm`
   - Database: `crm`
   - Port: `5432`

3. After installation, run:
```powershell
cd c:\dev\crm-monorepo\packages\db
pnpm exec prisma generate
pnpm exec prisma migrate dev --name add_reports
```

## Option 2: Use PostgreSQL via WSL2

If you have WSL2 installed:

```bash
# In WSL2 terminal
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start

# Create database
sudo -u postgres psql
CREATE USER crm WITH PASSWORD 'crm';
CREATE DATABASE crm OWNER crm;
\q
```

Then run migrations from Windows:
```powershell
cd c:\dev\crm-monorepo\packages\db
pnpm exec prisma generate
pnpm exec prisma migrate dev --name add_reports
```

## Option 3: Install Docker Desktop

1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and restart
3. Run:
```powershell
cd c:\dev\crm-monorepo
docker compose up -d
cd packages\db
pnpm exec prisma generate
pnpm exec prisma migrate dev --name add_reports
```

## Option 4: Use a Cloud Database (Free Tier)

Services like Supabase, Railway, or Neon offer free PostgreSQL databases:

1. Create a free account at: https://supabase.com/ (or https://railway.app/)
2. Get your connection string
3. Update `.env` file:
```
DATABASE_URL=postgresql://user:password@host:5432/database
```
4. Run migrations:
```powershell
cd c:\dev\crm-monorepo\packages\db
pnpm exec prisma generate
pnpm exec prisma migrate dev --name add_reports
```

## Verify Database Connection

After setting up PostgreSQL, test the connection:

```powershell
cd c:\dev\crm-monorepo\packages\db
pnpm exec prisma db pull
```

If successful, you should see your schema synchronized.

## Current Configuration

The `.env` file is configured to connect to:
```
DATABASE_URL=postgresql://crm:crm@localhost:5432/crm
```

This expects PostgreSQL running locally on port 5432 with:
- Username: crm
- Password: crm
- Database: crm

## After PostgreSQL is Running

Once PostgreSQL is accessible, the database will be automatically activated with:
- Report table (for storing all report configurations)
- ReportFolder table (for organizing reports)
- All necessary indexes and foreign keys
- API endpoints ready at `/reports` and `/reports/folders`
