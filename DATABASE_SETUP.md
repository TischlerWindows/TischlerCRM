# Database Setup Instructions

## Prerequisites
- Docker installed and running
- Node.js and pnpm installed

## Quick Start

### 1. Start PostgreSQL Database
```powershell
docker-compose up -d
```

### 2. Set Environment Variables
Create `.env` files:

**Root directory `.env`:**
```env
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
```

**`packages/db/.env`:**
```env
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
```

**`apps/api/.env`:**
```env
DATABASE_URL="postgresql://crm:crm@localhost:5432/crm?schema=public"
JWT_SECRET="your-secret-key-change-this-in-production"
```

### 3. Run Database Setup (All-in-One)
```powershell
cd apps/api
pnpm run db:setup
```

This will:
- Generate Prisma client from the schema
- Create database tables
- Seed initial data (admin user, Property and Account objects with fields)

### 4. Start the API Server
```powershell
# From apps/api directory
pnpm run dev
```

The API will be available at `http://localhost:3000`

### 5. Start the Web App
```powershell
# In a new terminal, from apps/web directory
cd apps/web
pnpm run dev
```

The web app will be available at `http://localhost:3001`

## Manual Setup (Step by Step)

If you prefer to run commands separately:

```powershell
# 1. Start database
docker-compose up -d

# 2. Generate Prisma client
cd packages/db
pnpm exec prisma generate

# 3. Create database schema
pnpm exec prisma migrate dev --name init

# 4. Seed initial data
cd ../../apps/api
pnpm run seed

# 5. Start API
pnpm run dev
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token

### Objects
- `GET /objects` - Get all custom objects
- `GET /objects/:apiName` - Get single object with fields and layouts
- `POST /objects` - Create new custom object
- `PUT /objects/:apiName` - Update custom object
- `DELETE /objects/:apiName` - Soft delete custom object

### Fields
- `GET /objects/:apiName/fields` - Get all fields for an object
- `POST /objects/:apiName/fields` - Create new field
- `PUT /objects/:apiName/fields/:fieldApiName` - Update field
- `DELETE /objects/:apiName/fields/:fieldApiName` - Soft delete field

### Page Layouts
- `GET /objects/:apiName/layouts` - Get all layouts for an object
- `GET /layouts/:layoutId` - Get single layout
- `POST /objects/:apiName/layouts` - Create new layout
- `PUT /layouts/:layoutId` - Update layout
- `DELETE /layouts/:layoutId` - Soft delete layout

### Records
- `GET /objects/:apiName/records` - Get all records (with pagination)
- `GET /objects/:apiName/records/:recordId` - Get single record
- `POST /objects/:apiName/records` - Create new record
- `PUT /objects/:apiName/records/:recordId` - Update record
- `DELETE /objects/:apiName/records/:recordId` - Delete record
- `GET /objects/:apiName/records/search?q=term` - Search records

## Testing with curl

### 1. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### 2. Create Property Object
```bash
curl -X POST http://localhost:3000/objects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "Property",
    "label": "Property",
    "pluralLabel": "Properties",
    "description": "Real estate properties"
  }'
```

### 3. Add Fields to Property
```bash
curl -X POST http://localhost:3000/objects/Property/fields \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiName": "address",
    "label": "Address",
    "type": "Text",
    "required": true
  }'
```

### 4. Create a Property Record
```bash
curl -X POST http://localhost:3000/objects/Property/records \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Main St",
    "city": "Toronto",
    "state": "ON"
  }'
```
