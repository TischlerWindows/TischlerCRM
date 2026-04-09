# Team Member Junction Object — Implementation Plan

## Context

TischlerCRM needs a junction object to manage contacts and accounts across the Property hierarchy (Property → Opportunities → Projects → Work Orders → Installations). When viewing a Property, users need a consolidated, de-duplicated view of ALL contacts and accounts across the entire tree. Each child object (Opportunity, Project, Work Order, Installation) also has its own team members.

This replaces the existing Salesforce `Project_Team_Member__c` junction object and LWC, rebuilt for TischlerCRM's metadata-driven architecture where objects, fields, and layouts are defined at runtime via `CustomObject`/`CustomField` tables and all data lives as JSON in the `Record` table.

**Design spec:** `docs/superpowers/specs/2026-04-08-team-member-junction-object-design.md`

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage approach | Metadata-driven CustomObject | Zero new backend code for CRUD, permissions, audit, search. GUI-manageable via Object Manager. |
| Member linking | Contact (required) + Account (optional) | Every team member is a person. Company context is optional. |
| Parent linking | Separate Lookup field per parent type | Existing Related List widget works out of the box. Validation enforces exactly one parent. |
| Role scope | Universal picklist | Same roles across all parent types. Editable in GUI. |
| Widget behavior | Configurable toggle (self-only vs Property rollup) | Toggle in Page Editor properties. Default varies by object. |

---

## Step 1: Register TeamMember CustomObject

### What
Add the TeamMember object definition to the core objects array so it's created on server startup.

### Where
`apps/api/src/ensure-core-objects.ts`

### How
Add a new object entry following the pattern used by Property, Contact, Account (lines 9–175). The object needs 12 fields:

| Field | apiName | Type | Required |
|-------|---------|------|----------|
| Team Member Number | teamMemberNumber | AutoNumber | Auto |
| Contact | contact | Lookup → Contact | Yes |
| Account | account | Lookup → Account | No |
| Property | property | Lookup → Property | No |
| Opportunity | opportunity | Lookup → Opportunity | No |
| Project | project | Lookup → Project | No |
| Work Order | workOrder | Lookup → WorkOrder | No |
| Installation | installation | Lookup → Installation | No |
| Role | role | Picklist | Yes |
| Primary Contact | primaryContact | Checkbox | No |
| Contract Holder | contractHolder | Checkbox | No |
| Notes | notes | LongText | No |

**Role picklist values:** Homeowner, General Contractor, Subcontractor, Architect / Designer, Property Manager, Sales Rep, Installer, Inspector, Engineer, Other

The existing `ensureFields()` function (line 455+) automatically creates `CustomField` records and `Relationship` records for each Lookup field.

### Validation Rules (Application-Level)
These will need to be enforced in the widget/form logic since the validation rule engine is not yet implemented server-side:
1. **Must Have Parent** — At least one of property, opportunity, project, workOrder, installation must be filled
2. **Only One Parent** — No more than one parent Lookup filled at a time
3. **Must Have Contact** — Enforced by `required: true` on the field

### Verify
- Start the API server
- Confirm TeamMember appears in Object Manager with all 12 fields
- Test CRUD: `POST /objects/TeamMember/records`, `GET /objects/TeamMember/records`

---

## Step 2: Add TypeScript Types for Widget Config

### What
Add the `TeamMembersRollupConfig` type so the widget config is type-safe and recognized by the layout system.

### Where
`apps/web/lib/schema.ts`

### How

1. Add interface after `HeaderHighlightsConfig` (~line 255):
```typescript
export interface TeamMembersRollupConfig {
  type: 'TeamMembersRollup';
  rollupFromProperty?: boolean;
  label?: string;
}
```

2. Add to the `WidgetConfig` union (~line 264):
```typescript
export type WidgetConfig =
  | RelatedListConfig
  | CustomComponentConfig
  | ActivityFeedConfig
  | FileFolderConfig
  | SpacerConfig
  | HeaderHighlightsConfig
  | ExternalWidgetLayoutConfig
  | TeamMembersRollupConfig;
```

3. Add `'TeamMembersRollup'` to the `WidgetType` type (search for its definition — likely a string union or enum).

---

## Step 3: Create Widget Manifest

### What
Define the widget metadata so it appears in the Page Editor widget palette.

### Where
Create: `apps/web/widgets/internal/team-members-rollup/widget.config.ts`

### How
Follow the pattern from `apps/web/widgets/internal/related-list/widget.config.ts`:

```typescript
export const config = {
  id: 'team-members-rollup',
  name: 'Team Members',
  description: 'Consolidated view of contacts and accounts across related records',
  icon: 'Users',
  category: 'internal' as const,
  integration: null,
  defaultDisplayMode: 'full' as const,
  configSchema: [],
};
```

---

## Step 4: Create ConfigPanel

### What
Build the configuration UI that appears in the Page Editor properties panel when this widget is selected.

### Where
Create: `apps/web/widgets/internal/team-members-rollup/ConfigPanel.tsx`

### How
Follow the pattern from `apps/web/widgets/internal/header-highlights/ConfigPanel.tsx`. Two config options:

1. **rollupFromProperty** — Toggle/checkbox labeled "Show all team members from Property tree"
   - When checked: widget fetches from current record + full Property hierarchy
   - When unchecked: widget fetches only current record's team members
2. **label** — Text input for custom widget header label (default: "Team Members")

Use `ConfigPanelProps` from `apps/web/lib/widgets/types.ts`. Call `onChange(updatedConfig)` on every change.

---

## Step 5: Create the Rollup Widget Component

### What
The main widget component — the largest piece of work. Renders the two-column tile view with data fetching, de-duplication, add modal, inline edit, and delete.

### Where
Create: `apps/web/widgets/internal/team-members-rollup/index.tsx`

### Subsections

#### 5a: Data Fetching

Use `apiClient` from `apps/web/lib/api-client.ts` (reference the Related List fetch pattern at `apps/web/widgets/internal/related-list/index.tsx` lines 213–228).

**Self-only mode** (`rollupFromProperty: false`):
1. Map current object to its parent field (e.g., Opportunity → `opportunity`)
2. Single fetch: `GET /objects/TeamMember/records?filter[opportunity]={recordId}`

**Rollup mode** (`rollupFromProperty: true`):
1. Determine Property ID:
   - If current object IS Property → use `record.id`
   - Otherwise → use `record.property` or `record.data.property`
2. Parallel fetch Phase 1 — get child record IDs:
   - `GET /objects/Opportunity/records?filter[property]={propertyId}` → collect IDs
   - Same for Project, WorkOrder, Installation
3. Parallel fetch Phase 2 — get team members:
   - `filter[property]={propertyId}`
   - `filter[opportunity]={id1,id2,...}` (if any Opportunities found)
   - Same for Project, WorkOrder, Installation
4. Merge all results

#### 5b: De-duplication Logic

**Contacts:**
- Build `Map<contactId, MergedContact>` from all team member records
- For each Contact ID, merge: aggregate "via" sources, collect all badges (Primary/Contract Holder from any record), track which team member record belongs to the current record (for edit permissions)

**Accounts:**
- Build `Map<accountId, MergedAccount>` from team members that have an Account
- Same merge logic: aggregate "via" sources and badges

#### 5c: Tile Rendering

Two-column grid layout using Tailwind CSS:
- **Left column:** Contacts (with count header)
- **Right column:** Accounts (with count header, derived from Contact data)

Each tile shows:
- Name (clickable → navigates to Contact/Account record via Next.js router)
- Role
- Account name under Contact name (for Contact tiles with optional Account)
- "via: Record Name" links (clickable → navigate to parent record)
- Primary badge (green pill)
- Contract Holder badge (orange pill)

Match the visual style of the existing Related List tile view.

#### 5d: Add Team Member Modal

Build a stepped modal dialog:
- **Step 1:** Search for a Contact (reuse `LookupSearch` from `apps/web/components/form/lookup-search.tsx`)
- **Step 2:** Optionally search/select an Account (same LookupSearch component)
- **Step 3:** Set Role (picklist dropdown), Primary Contact (checkbox), Contract Holder (checkbox)
- Pre-fill the parent Lookup field based on the current record's object type and ID
- On save: `POST /objects/TeamMember/records` with the assembled data

Alternatively, evaluate reusing `DynamicFormDialog` from `apps/web/components/DynamicFormDialog.tsx` if it supports the stepped flow.

#### 5e: Inline Edit

- Track editing state per tile (only tiles belonging to current record are editable)
- On edit click: show Role dropdown, Primary/Contract Holder checkboxes inline
- On save: `PUT /objects/TeamMember/records/{id}` with updated fields
- On cancel: revert to read-only display

#### 5f: Delete

- Show remove button on tiles belonging to the current record
- Confirmation dialog before delete
- `DELETE /objects/TeamMember/records/{id}`
- Refresh widget data after deletion

---

## Step 6: Register the Widget

### What
Add the widget to the internal registry so it's discoverable by the layout system and Page Editor.

### Where
`apps/web/widgets/internal/registry.ts`

### How
Add imports and registration entry following the existing pattern (lines 1–41):

```typescript
import { config as teamMembersRollupManifest } from './team-members-rollup/widget.config'
import TeamMembersRollupConfigPanel from './team-members-rollup/ConfigPanel'

// Add to internalWidgetRegistrations array:
{
  manifest: teamMembersRollupManifest,
  widgetConfigType: 'TeamMembersRollup',
  Component: dynamic(() => import('./team-members-rollup/index')),
  ConfigPanel: TeamMembersRollupConfigPanel,
}
```

---

## Step 7: Verify Page Editor Integration

### What
Ensure the widget works in the Page Editor — can be dragged onto layouts, configured, and previewed.

### Where
- `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx`
- `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx`

### How
1. Verify `getInternalRegistrationByType('TeamMembersRollup')` resolves correctly in `widget-config-panel.tsx` — the existing dispatch logic should handle this automatically since we're using the standard registration pattern.
2. Check `summarizeWidget()` in `canvas-widget.tsx` — add a case for `TeamMembersRollup` if needed, showing something like "Team Members (Rollup: On/Off)".

---

## Critical Files Reference

| File | Role |
|------|------|
| `apps/api/src/ensure-core-objects.ts` | Object/field registration (add TeamMember here) |
| `apps/web/lib/schema.ts` | TypeScript types for widget configs (add TeamMembersRollupConfig) |
| `apps/web/lib/api-client.ts` | HTTP client for API calls (reuse in widget) |
| `apps/web/lib/widgets/types.ts` | WidgetProps, ConfigPanelProps, WidgetRegistration interfaces |
| `apps/web/widgets/internal/registry.ts` | Widget registration array (add entry) |
| `apps/web/widgets/internal/related-list/index.tsx` | Reference: data fetching, tile view pattern |
| `apps/web/widgets/internal/related-list/ConfigPanel.tsx` | Reference: config panel pattern |
| `apps/web/widgets/internal/header-highlights/ConfigPanel.tsx` | Reference: simpler config panel |
| `apps/web/components/form/lookup-search.tsx` | Reusable lookup/search for Add modal |
| `apps/web/components/DynamicFormDialog.tsx` | Potential reuse for Add Team Member modal |
| `apps/web/components/layout-widgets-inline.tsx` | Widget rendering dispatcher (auto-handles new types) |
| `apps/web/app/object-manager/[objectApi]/page-editor/properties/widget-config-panel.tsx` | Config panel rendering in page editor |
| `apps/web/app/object-manager/[objectApi]/page-editor/canvas-widget.tsx` | Widget preview card in editor canvas |

---

## Verification Plan

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Start API server, check Object Manager | TeamMember object with all 12 fields visible |
| 2 | Create TeamMember via API | Record created with auto-number, stored in Record table |
| 3 | Add Related List widget for TeamMember on Opportunity layout | Shows only that Opportunity's team members |
| 4 | Add TeamMembersRollup widget to Property layout | Shows de-duplicated contacts/accounts from Property + all children |
| 5 | Add widget to Work Order with rollup OFF | Shows only Work Order's team members |
| 6 | Toggle rollup ON for Work Order widget | Full Property tree team members appear |
| 7 | Click "+ Add Team Member" | Modal opens, can search contact, set role, save |
| 8 | Inline edit a team member's role | Role updates, tile refreshes |
| 9 | Remove a team member | Tile disappears after confirmation |
| 10 | Click contact name in tile | Navigates to Contact record page |
| 11 | Click "via" link in tile | Navigates to parent record (Opportunity, Project, etc.) |
| 12 | Open Page Editor, drag Team Members widget | Widget appears, config toggle works, saves to layout |

---

## Implementation Order & Dependencies

```
Step 1 (Backend: Object Registration)
  ↓
Step 2 (Types: Schema additions)
  ↓
Step 3 (Widget: Manifest) ──┐
Step 4 (Widget: ConfigPanel) ├── Can be done in parallel
Step 5 (Widget: Component)  ──┘
  ↓
Step 6 (Registry: Wire up)
  ↓
Step 7 (Page Editor: Verify)
```

Steps 3, 4, and 5 can be developed in parallel once Steps 1 and 2 are complete. Step 5 is the largest piece of work and can be broken into sub-tasks (5a–5f) if needed.
