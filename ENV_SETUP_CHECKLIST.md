# Environment Variables Checklist

## Local Development Setup ✓

### Web App (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### API (`apps/api/.env`)
```
APP_ENV=development
DATABASE_URL=postgresql://crm:crm@localhost:5432/crm?schema=public
JWT_SECRET=dev-secret-key-change-in-production
```

**Status:** ✅ Already configured for local development

---

## Production Setup (Before Deploying)

### Step 1: Generate Strong JWT Secret

Choose one method:

#### Option A: Node.js (Cross-platform)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Option B: OpenSSL (Linux/Mac)
```bash
openssl rand -hex 32
```

#### Option C: PowerShell (Windows)
```powershell
[System.BitConverter]::ToString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) -replace "-"
```

**Copy the output and save it securely** (you'll need it for API configuration)

---

### Step 2: Set Up Cloud PostgreSQL

Choose one platform:

#### Option A: Railway (Recommended)
1. Go to [railway.app](https://railway.app) and create account
2. New Project → Add PostgreSQL
3. Copy the `DATABASE_URL` from the PostgreSQL plugin

#### Option B: Render
1. Go to [render.com](https://render.com)
2. Create PostgreSQL Database
3. Copy the external database URL

#### Option C: Fly.io
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Run: `fly postgres create`
3. Copy the connection string

#### Option D: AWS RDS / DigitalOcean / GCP Cloud SQL
1. Create PostgreSQL instance
2. Get connection details from console

---

### Step 3: Web App Configuration

#### For Vercel Deployment:
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Add:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://your-api-domain.com
   Environments: Production
   ```

#### For Railway Deployment:
1. In Railway Dashboard → Web service
2. Variables tab
3. Add:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://your-api.railway.app
   ```

#### For Self-Hosted:
Create `.env.production`:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

### Step 4: API Configuration

#### For Railway Deployment:
1. In Railway Dashboard → API service
2. Variables tab
3. Add these variables:
   ```
   APP_ENV: production
   DATABASE_URL: postgresql://user:password@host:5432/crm?schema=public
   JWT_SECRET: <your-generated-secret>
   ```

#### For Vercel (Node.js Runtime):
1. Create `vercel.json`:
   ```json
   {
     "buildCommand": "pnpm build",
     "outputDirectory": "dist",
     "env": {
       "DATABASE_URL": "@database_url",
       "JWT_SECRET": "@jwt_secret"
     }
   }
   ```
2. In Vercel Dashboard → Settings → Environment Variables
3. Add `DATABASE_URL` and `JWT_SECRET`

#### For Fly.io:
```bash
fly secrets set DATABASE_URL="postgresql://user:password@host/crm"
fly secrets set JWT_SECRET="your-generated-secret"
```

#### For Self-Hosted:
Create `.env.production`:
```
APP_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/crm?schema=public
JWT_SECRET=your-generated-secret
```

---

### Step 5: Verify Database Connection

Run this before deploying to ensure the connection works:

```bash
# Test with psql (if installed)
psql "postgresql://user:password@host:5432/crm"

# Or test with Node.js
node -e "
const PrismaClient = require('@prisma/client').PrismaClient;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'your-database-url-here'
    }
  }
});
prisma.\$connect().then(() => {
  console.log('✅ Database connected');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
"
```

---

### Step 6: Push Database Schema

Once database is set up, run migrations:

```bash
# Set the database URL for this command
DATABASE_URL="postgresql://user:password@host:5432/crm" \
pnpm --filter db prisma db push
```

You should see:
```
✓ Your database is now in sync with your Prisma schema
```

---

### Step 7: Deploy Services

#### Railway (All-in-one):
1. Connect GitHub repo
2. Create services: PostgreSQL, API, Web
3. Set environment variables
4. Deploy button

#### Vercel + Railway:
```bash
# Deploy API to Railway
cd apps/api
railway link
railway up

# Deploy Web to Vercel
cd ../web
vercel --prod
```

#### Fly.io:
```bash
# Deploy API
cd apps/api
fly deploy

# Deploy Web
cd ../web
fly deploy
```

---

## Environment Variables Summary

| Service | Variable | Required | Value |
|---------|----------|----------|-------|
| **Web** | `NEXT_PUBLIC_API_URL` | ✅ Yes | `https://api.yourdomain.com` |
| **API** | `DATABASE_URL` | ✅ Yes | `postgresql://user:pass@host/crm` |
| **API** | `JWT_SECRET` | ✅ Yes | 32+ random chars |
| **API** | `APP_ENV` | ⭕ Optional | `production` |

---

## Troubleshooting

### "DATABASE_URL is invalid"
- [ ] Check PostgreSQL connection string format
- [ ] Verify username and password
- [ ] Confirm database name is correct
- [ ] Test connection: `psql "your-database-url"`

### "JWT_SECRET validation failed"
- [ ] Ensure JWT_SECRET is at least 16 characters
- [ ] Regenerate with provided command if unsure
- [ ] Must be same across API and any other services

### "Cannot connect to database" in production
- [ ] Check firewall/security groups allow your IP
- [ ] Verify PostgreSQL service is running
- [ ] Test with `psql` command first
- [ ] Check DATABASE_URL in deployment platform

### "API endpoint not found from Web"
- [ ] Verify `NEXT_PUBLIC_API_URL` is set correctly
- [ ] No trailing slash: `https://api.domain.com` ✅ vs `https://api.domain.com/` ❌
- [ ] Check CORS is enabled on API
- [ ] Test API directly: `curl https://api.yourdomain.com/health`

### "401 Unauthorized" after login
- [ ] Ensure JWT_SECRET is consistent
- [ ] Check token expiration
- [ ] Verify Authorization header format: `Bearer <token>`

---

## Next Steps After Setup

1. ✅ Generate JWT secret
2. ✅ Set up cloud PostgreSQL
3. ✅ Configure web environment variables
4. ✅ Configure API environment variables
5. ✅ Test database connection
6. ✅ Push schema to cloud DB
7. Deploy Web app
8. Deploy API service
9. Test login flow
10. Monitor logs for errors

---

**See Also:** [PRODUCTION_ENV_SETUP.md](./PRODUCTION_ENV_SETUP.md) for detailed platform-specific instructions
