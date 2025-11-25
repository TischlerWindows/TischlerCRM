# Quick Setup Commands

Run these commands in PowerShell to get your backend database up and running:

## 1. Start Docker PostgreSQL
```powershell
docker-compose up -d
```

## 2. Create Environment Files

### Create `packages/db/.env`
```powershell
Set-Content -Path "packages\db\.env" -Value "DATABASE_URL=`"postgresql://crm:crm@localhost:5432/crm?schema=public`""
```

### Create `apps/api/.env`
```powershell
@"
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
JWT_SECRET="change-this-secret-key-in-production"
"@ | Set-Content -Path "apps\api\.env"
```

## 3. Setup Database (All-in-One)
```powershell
cd apps\api
pnpm run db:setup
```

Wait for this to complete. You should see:
- ✅ Created admin user
- ✅ Created Property object  
- ✅ Created Property fields
- ✅ Created Account object
- ✅ Created Account fields

## 4. Start API Server
```powershell
# Still in apps/api
pnpm run dev
```

## 5. Start Web App (New Terminal)
```powershell
cd apps\web
pnpm run dev
```

## Test the API

### Login
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -Body (@{email="admin@crm.local";password="admin123"} | ConvertTo-Json) -ContentType "application/json"
$token = $response.token
```

### Get All Objects
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/objects" -Headers @{Authorization="Bearer $token"}
```

### Get Property Object with Fields
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/objects/Property" -Headers @{Authorization="Bearer $token"}
```

### Create a Property Record
```powershell
$property = @{
  propertyNumber = "P-001"
  address = "123 Main Street"
  city = "Toronto"
  state = "ON"
  zipCode = "M5V 3A3"
  status = "Active"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/objects/Property/records" -Method Post -Headers @{Authorization="Bearer $token"} -Body $property -ContentType "application/json"
```

### Get All Property Records
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/objects/Property/records" -Headers @{Authorization="Bearer $token"}
```

## Troubleshooting

### Database Connection Issues
```powershell
# Check if PostgreSQL is running
docker ps

# View PostgreSQL logs
docker logs crm-postgres

# Restart PostgreSQL
docker-compose restart
```

### Prisma Issues
```powershell
# Regenerate Prisma client
cd packages\db
pnpm exec prisma generate

# Reset database (WARNING: Deletes all data!)
pnpm exec prisma migrate reset
```

### Port Conflicts
If port 5432 is in use:
```powershell
# Check what's using port 5432
netstat -ano | findstr :5432

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

## Next Steps

1. Open the web app at http://localhost:3001
2. The frontend schema store currently uses localStorage
3. To integrate with the backend, you'll need to:
   - Update `schema-store.ts` to fetch from `/objects` API
   - Add authentication token management
   - Update record operations to use `/objects/:apiName/records` API

See `BACKEND_ARCHITECTURE.md` for more details on integration.
