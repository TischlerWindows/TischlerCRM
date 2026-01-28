# Reports Database Setup

This migration adds the Reports and ReportFolder tables to the database.

## Schema Changes

### New Models:
1. **Report** - Stores report configurations
   - Fields: name, description, objectType, format, fields, filters, groupBy, sortBy, sortOrder
   - Permissions: isStandard, isPrivate, sharedWith, isFavorite
   - Relations: folderId, createdBy, modifiedBy

2. **ReportFolder** - Organizes reports into folders
   - Fields: name, description, parentId (for nested folders)
   - Permissions: isPrivate, sharedWith
   - Relations: parent, children, reports, createdBy, modifiedBy

## Running the Migration

### Option 1: Using Prisma Migrate (Recommended for Production)

```bash
# Navigate to the db package
cd packages/db

# Generate Prisma Client with new models
pnpm exec prisma generate

# Create and run migration
pnpm exec prisma migrate dev --name add_reports

# Or if already in production:
pnpm exec prisma migrate deploy
```

### Option 2: Manual SQL (Development)

```bash
# Connect to your database and run the migration.sql file
psql -U your_username -d your_database -f packages/db/prisma/migrations/add_reports/migration.sql
```

### Option 3: Prisma Studio (Visual)

```bash
cd packages/db
pnpm exec prisma studio
```

## Verify Installation

After running the migration, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('Report', 'ReportFolder');

-- Check Report table structure
\d "Report"

-- Check ReportFolder table structure
\d "ReportFolder"
```

## API Endpoints

Once the migration is complete, the following endpoints will be available:

### Reports
- `GET /reports` - List all reports (with filters)
- `GET /reports/:id` - Get single report
- `POST /reports` - Create report
- `PUT /reports/:id` - Update report
- `PATCH /reports/:id/favorite` - Toggle favorite
- `PATCH /reports/:id/private` - Toggle private
- `POST /reports/:id/share` - Share report
- `DELETE /reports/:id` - Delete report

### Folders
- `GET /reports/folders` - List all folders
- `POST /reports/folders` - Create folder
- `PUT /reports/folders/:id` - Update folder
- `DELETE /reports/folders/:id` - Delete folder

## Testing

After migration, you can test the API:

```bash
# Create a test report
curl -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Report",
    "description": "My first report",
    "objectType": "properties",
    "format": "tabular",
    "fields": ["propertyNumber", "address", "status"],
    "filters": []
  }'

# List all reports
curl http://localhost:3000/reports \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rollback

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "ReportFolder" CASCADE;
```

Or using Prisma:

```bash
cd packages/db
pnpm exec prisma migrate resolve --rolled-back add_reports
```
