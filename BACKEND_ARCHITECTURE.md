# Backend Database Architecture

## Overview

The CRM system now has a complete metadata-driven backend that supports:
- ✅ Dynamic custom objects (like Property, Account, Contact, etc.)
- ✅ Dynamic custom fields with validation
- ✅ Page layouts for UI configuration
- ✅ Actual record storage and retrieval
- ✅ Full CRUD operations via REST API

## Database Schema

### Core Tables

#### CustomObject
Stores metadata about custom objects (Property, Account, etc.)
- `apiName`: Unique identifier (e.g., "Property")
- `label`: Display name
- `fields`: Related custom fields
- `pageLayouts`: Related UI layouts
- `records`: Actual data records

#### CustomField  
Stores metadata about fields within objects
- `apiName`: Field identifier (e.g., "address")
- `type`: Field type (Text, Number, Date, Picklist, etc.)
- `required`, `unique`, `readOnly`: Constraints
- `min`, `max`, `scale`: Number validation
- `picklistValues`: Options for dropdowns
- Supports relationships (Lookup fields)

#### PageLayout
Stores UI configuration for forms
- `tabs`: Multiple tabs in a form
- `sections`: Sections within tabs
- `fields`: Fields within sections
- Defines column layout (1, 2, or 3 columns)

#### Record
Stores actual data for all custom objects
- `objectId`: Links to CustomObject
- `data`: JSON field containing all field values
- Flexible schema - can store any fields defined in CustomObject
- Includes audit fields (createdBy, modifiedBy, timestamps)

## API Endpoints

### Objects API (`/objects`)
Manage custom object definitions:
```
GET    /objects                    # List all objects
GET    /objects/:apiName           # Get object with fields & layouts
POST   /objects                    # Create new object
PUT    /objects/:apiName           # Update object
DELETE /objects/:apiName           # Soft delete object
```

### Fields API (`/objects/:apiName/fields`)
Manage fields within objects:
```
GET    /objects/:apiName/fields            # List fields
POST   /objects/:apiName/fields            # Create field
PUT    /objects/:apiName/fields/:fieldApi  # Update field
DELETE /objects/:apiName/fields/:fieldApi  # Delete field
```

### Layouts API (`/objects/:apiName/layouts`)
Manage page layouts:
```
GET    /objects/:apiName/layouts   # List layouts
GET    /layouts/:layoutId          # Get single layout
POST   /objects/:apiName/layouts   # Create layout
PUT    /layouts/:layoutId          # Update layout
DELETE /layouts/:layoutId          # Delete layout
```

### Records API (`/objects/:apiName/records`)
Manage actual data:
```
GET    /objects/:apiName/records              # List records (paginated)
GET    /objects/:apiName/records/:recordId    # Get single record
POST   /objects/:apiName/records              # Create record
PUT    /objects/:apiName/records/:recordId    # Update record
DELETE /objects/:apiName/records/:recordId    # Delete record
GET    /objects/:apiName/records/search?q=x   # Search records
```

## Data Flow

### Creating a Property (Example)

1. **Define Object** (if not exists):
```json
POST /objects
{
  "apiName": "Property",
  "label": "Property",
  "pluralLabel": "Properties"
}
```

2. **Add Fields**:
```json
POST /objects/Property/fields
{
  "apiName": "address",
  "label": "Address",
  "type": "Text",
  "required": true
}
```

3. **Create Page Layout**:
```json
POST /objects/Property/layouts
{
  "name": "Property Layout",
  "layoutType": "edit",
  "tabs": [{
    "label": "Information",
    "order": 0,
    "sections": [{
      "label": "Address Details",
      "columns": 2,
      "order": 0,
      "fields": [{
        "fieldApiName": "address",
        "column": 0,
        "order": 0
      }]
    }]
  }]
}
```

4. **Create Property Record**:
```json
POST /objects/Property/records
{
  "address": "123 Main St",
  "city": "Toronto",
  "state": "ON",
  "zipCode": "M5V 3A3",
  "status": "Active"
}
```

## Integration with Frontend

### Schema Store
The frontend `useSchemaStore` should be updated to fetch from the API:

```typescript
// Instead of localStorage, fetch from API
const fetchSchema = async () => {
  const response = await fetch('/api/objects', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### Dynamic Forms
Forms automatically render based on page layouts from the database.

### Record Management
Properties, Accounts, and other objects are stored as Record entries with JSON data.

## Next Steps

To integrate the frontend with this backend:

1. **Update Schema Store** - Fetch from `/objects` API instead of localStorage
2. **Update Record Operations** - Use `/objects/:apiName/records` API
3. **Sync Page Layouts** - Save layouts to API when modified in Page Editor
4. **Add Authentication** - Store JWT token and include in requests

## Seeded Data

The seed script creates:
- Admin user: `admin@crm.local` / `admin123`
- Property object with fields:
  - propertyNumber, address, city, state, zipCode, status
- Account object with fields:
  - accountNumber, name, type, email, phone

## Benefits

✨ **Fully Dynamic**: Add new objects and fields without code changes
✨ **Type Safe**: Prisma provides TypeScript types
✨ **Audit Trail**: Track who created/modified records
✨ **Flexible**: JSON storage allows schema evolution
✨ **Scalable**: PostgreSQL handles millions of records
✨ **Multi-tenant Ready**: Can add tenant isolation easily
