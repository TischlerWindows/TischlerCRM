# Dashboard API Reference

## Base URL

Development: `http://localhost:4000`  
Production: `https://your-api.domain.com`

## Authentication

All endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Obtain token via: `POST /auth/login`

## Endpoints

### Dashboards

#### GET /dashboards
List all dashboards accessible to the current user (owned or public).

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Sales Dashboard",
    "description": "Q4 sales tracking",
    "isPrivate": false,
    "isFavorite": true,
    "createdAt": "2024-02-11T10:00:00Z",
    "updatedAt": "2024-02-11T10:00:00Z",
    "createdBy": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "widgets": [
      {
        "id": "uuid",
        "type": "vertical-bar",
        "title": "Monthly Revenue",
        "dataSource": "accounts",
        "positionX": 0,
        "positionY": 0,
        "width": 6,
        "height": 3
      }
    ]
  }
]
```

**Query Parameters:**
- None

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

#### POST /dashboards
Create a new dashboard.

**Request Body:**
```json
{
  "name": "New Dashboard",
  "description": "Optional description",
  "widgets": [
    {
      "type": "vertical-bar",
      "title": "Chart Title",
      "dataSource": "accounts",
      "reportId": "uuid-optional",
      "config": {
        "color": "#FF6B6B"
      },
      "position": {
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 3
      }
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "New Dashboard",
  "description": "Optional description",
  "isPrivate": false,
  "isFavorite": false,
  "createdAt": "2024-02-11T10:00:00Z",
  "updatedAt": "2024-02-11T10:00:00Z",
  "createdBy": { ... },
  "widgets": [ ... ]
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request (name required)
- `401` - Unauthorized

---

#### GET /dashboards/:id
Get a specific dashboard by ID.

**URL Parameters:**
- `id` - Dashboard ID (UUID)

**Response:**
```json
{
  "id": "uuid",
  "name": "Sales Dashboard",
  "description": "Q4 sales tracking",
  "isPrivate": false,
  "isFavorite": true,
  "createdAt": "2024-02-11T10:00:00Z",
  "updatedAt": "2024-02-11T10:00:00Z",
  "createdBy": { ... },
  "widgets": [ ... ]
}
```

**Status Codes:**
- `200` - Success
- `403` - Forbidden (private dashboard not owned by user)
- `404` - Not found
- `401` - Unauthorized

---

#### PUT /dashboards/:id
Update a dashboard. Only the owner can update.

**URL Parameters:**
- `id` - Dashboard ID (UUID)

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "isFavorite": true,
  "widgets": [
    {
      "type": "vertical-bar",
      "title": "Chart Title",
      "dataSource": "accounts",
      "config": {},
      "position": { "x": 0, "y": 0, "w": 6, "h": 3 }
    }
  ]
}
```

**Response:**
```json
{ ... updated dashboard ... }
```

**Status Codes:**
- `200` - Updated
- `403` - Forbidden (not owner)
- `404` - Not found
- `401` - Unauthorized

---

#### DELETE /dashboards/:id
Delete a dashboard. Only the owner can delete.

**URL Parameters:**
- `id` - Dashboard ID (UUID)

**Response:**
```
(No content)
```

**Status Codes:**
- `204` - Deleted
- `403` - Forbidden (not owner)
- `404` - Not found
- `401` - Unauthorized

---

### Dashboard Widgets

#### GET /dashboards/:id/widgets
List all widgets in a dashboard.

**URL Parameters:**
- `id` - Dashboard ID (UUID)

**Response:**
```json
[
  {
    "id": "uuid",
    "dashboardId": "uuid",
    "type": "vertical-bar",
    "title": "Monthly Revenue",
    "dataSource": "accounts",
    "reportId": "uuid-optional",
    "config": {
      "color": "#FF6B6B",
      "showLegend": true
    },
    "positionX": 0,
    "positionY": 0,
    "width": 6,
    "height": 3,
    "createdAt": "2024-02-11T10:00:00Z",
    "updatedAt": "2024-02-11T10:00:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `403` - Forbidden (private dashboard not owned)
- `404` - Dashboard not found
- `401` - Unauthorized

---

#### POST /dashboards/:id/widgets
Add a widget to a dashboard. Only the owner can add widgets.

**URL Parameters:**
- `id` - Dashboard ID (UUID)

**Request Body:**
```json
{
  "type": "vertical-bar",
  "title": "New Widget",
  "dataSource": "accounts",
  "reportId": "uuid-optional",
  "config": {
    "color": "#FF6B6B",
    "showLegend": true,
    "showGrid": true
  },
  "position": {
    "x": 6,
    "y": 0,
    "w": 6,
    "h": 3
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "dashboardId": "uuid",
  "type": "vertical-bar",
  "title": "New Widget",
  "dataSource": "accounts",
  "reportId": null,
  "config": { ... },
  "positionX": 6,
  "positionY": 0,
  "width": 6,
  "height": 3,
  "createdAt": "2024-02-11T10:00:00Z",
  "updatedAt": "2024-02-11T10:00:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Bad request (required fields: type, title, dataSource)
- `403` - Forbidden (not dashboard owner)
- `404` - Dashboard not found
- `401` - Unauthorized

---

#### PUT /dashboards/:id/widgets/:widgetId
Update a widget. Only the dashboard owner can update.

**URL Parameters:**
- `id` - Dashboard ID (UUID)
- `widgetId` - Widget ID (UUID)

**Request Body:**
```json
{
  "type": "horizontal-bar",
  "title": "Updated Widget",
  "dataSource": "accounts",
  "reportId": "uuid-optional",
  "config": {
    "color": "#4ECDC4"
  },
  "position": {
    "x": 0,
    "y": 3,
    "w": 12,
    "h": 3
  }
}
```

**Response:**
```json
{ ... updated widget ... }
```

**Status Codes:**
- `200` - Updated
- `403` - Forbidden (not dashboard owner)
- `404` - Widget or dashboard not found
- `401` - Unauthorized

---

#### DELETE /dashboards/:id/widgets/:widgetId
Remove a widget from a dashboard. Only the dashboard owner can delete.

**URL Parameters:**
- `id` - Dashboard ID (UUID)
- `widgetId` - Widget ID (UUID)

**Response:**
```
(No content)
```

**Status Codes:**
- `204` - Deleted
- `403` - Forbidden (not dashboard owner)
- `404` - Widget or dashboard not found
- `401` - Unauthorized

---

## Widget Types

Supported widget types for the `type` field:

- `vertical-bar` - Vertical bar chart
- `horizontal-bar` - Horizontal bar chart
- `line` - Line chart
- `donut` - Donut/pie chart
- `metric` - Single metric card
- `table` - Data table
- `area` - Area chart
- `scatter` - Scatter plot

---

## Data Sources

Supported `dataSource` values correspond to custom objects:

- `accounts` - Account records
- `contacts` - Contact records
- `opportunities` - Opportunity/deal records
- `leads` - Lead records
- `products` - Product records
- Any custom object API name

---

## Widget Configuration

The `config` field is flexible JSON that stores widget-specific settings:

```json
{
  "color": "#FF6B6B",
  "showLegend": true,
  "showGrid": true,
  "showValues": true,
  "dataKey": "amount",
  "labelKey": "name",
  "sortBy": "date",
  "sortOrder": "desc"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Descriptive error message"
}
```

Common error messages:

| Status | Error | Cause |
|--------|-------|-------|
| 400 | `Bad request` | Missing required fields |
| 401 | `Unauthorized` | Missing or invalid token |
| 403 | `Access denied` | User doesn't own resource |
| 404 | `Not found` | Resource doesn't exist |
| 500 | `Failed to [action]` | Server error |

---

## Example Requests

### Create Dashboard with Widgets

```bash
curl -X POST http://localhost:4000/dashboards \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Dashboard",
    "description": "Q4 2024 sales performance",
    "widgets": [
      {
        "type": "vertical-bar",
        "title": "Revenue by Month",
        "dataSource": "accounts",
        "config": { "color": "#FF6B6B" },
        "position": { "x": 0, "y": 0, "w": 6, "h": 3 }
      },
      {
        "type": "metric",
        "title": "Total Revenue",
        "dataSource": "accounts",
        "config": {},
        "position": { "x": 6, "y": 0, "w": 6, "h": 3 }
      }
    ]
  }'
```

### Add Widget to Dashboard

```bash
curl -X POST http://localhost:4000/dashboards/{dashboardId}/widgets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "line",
    "title": "Trend Analysis",
    "dataSource": "accounts",
    "config": {},
    "position": { "x": 0, "y": 3, "w": 12, "h": 3 }
  }'
```

### Update Dashboard

```bash
curl -X PUT http://localhost:4000/dashboards/{dashboardId} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Dashboard Name",
    "isFavorite": true
  }'
```

### Delete Widget

```bash
curl -X DELETE http://localhost:4000/dashboards/{dashboardId}/widgets/{widgetId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Best Practices

1. **Coordinate Size:** Use grid system where total width = 12 units
   - Small widget: w=6, h=2
   - Medium widget: w=6, h=3
   - Large widget: w=12, h=4

2. **Position Ordering:** Position widgets by `positionY` first, then `positionX`

3. **Widget Config:** Store chart-specific settings in `config` for flexibility

4. **Error Handling:** Always check HTTP status codes and parse error messages

5. **Token Management:** Refresh tokens before expiration, handle 401s gracefully

6. **Batch Operations:** Use single PUT request to update all widgets instead of multiple requests

---

## Rate Limiting

Currently no rate limiting. Production deployment should implement:
- 100 requests/minute per user
- 1000 requests/hour per API key

---

## Changelog

### v1.0.0 (Current)
- Initial dashboard API
- CRUD operations for dashboards and widgets
- User-based access control
- Widget positioning and configuration
