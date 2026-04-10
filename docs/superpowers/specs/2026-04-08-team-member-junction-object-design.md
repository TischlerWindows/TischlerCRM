# Team Member Junction Object — Design Spec

## Context

TischlerCRM needs a way to manage the multiple contacts and accounts associated with Properties, Opportunities, Projects, Work Orders, and Installations. A Property is the top of the hierarchy — it has child Opportunities, Projects, Work Orders, and Installations, each of which may have their own team members. When viewing a Property, users need a consolidated view of ALL contacts and accounts across the entire Property tree.

This mirrors the existing Salesforce `Project_Team_Member__c` junction object and LWC, rebuilt for TischlerCRM's metadata-driven architecture.

## Design Decisions

1. **Metadata-driven CustomObject** — TeamMember is defined as a CustomObject in the dynamic schema (like Property, Contact, Account), managed via Object Manager GUI. No new Prisma models or migrations needed.

2. **Contact required, Account optional** — Every team member is a person (Contact). An Account (company) can optionally be linked for context.

3. **Separate Lookup fields per parent type** — One Lookup field for each parent: Property, Opportunity, Project, WorkOrder, Installation. Exactly one must be filled per record. Existing Related List widget works out of the box.

4. **Universal Role picklist** — Same role options across all parent types. Editable in the GUI anytime.

5. **Widget toggle for rollup vs self-only** — A config toggle in the Page Editor controls whether the widget shows only the current record's team members or the full Property tree rollup.

## Object Definition: TeamMember

**apiName:** `TeamMember`
**label:** Team Member
**pluralLabel:** Team Members

### Fields

| Field | API Name | Type | Required | Notes |
|-------|----------|------|----------|-------|
| Team Member Number | teamMemberNumber | AutoNumber | Auto | Auto-generated (TM-0001) |
| Contact | contact | Lookup → Contact | Yes | The person |
| Account | account | Lookup → Account | No | Their company (optional) |
| Property | property | Lookup → Property | No | Parent — exactly one parent Lookup must be filled |
| Opportunity | opportunity | Lookup → Opportunity | No | Parent |
| Project | project | Lookup → Project | No | Parent |
| Work Order | workOrder | Lookup → WorkOrder | No | Parent |
| Installation | installation | Lookup → Installation | No | Parent |
| Role | role | Picklist | Yes | Universal role picklist |
| Primary Contact | primaryContact | Checkbox | No | Is this the main point of contact? |
| Contract Holder | contractHolder | Checkbox | No | Is this the contract signer? |
| Notes | notes | LongText | No | Freeform notes |

### Role Picklist Values (Initial)

- Homeowner
- General Contractor
- Subcontractor
- Architect / Designer
- Property Manager
- Sales Rep
- Installer
- Inspector
- Engineer
- Other

### Validation Rules

1. **Must Have Parent** — At least one parent Lookup (property, opportunity, project, workOrder, installation) must be filled.
2. **Only One Parent** — No more than one parent Lookup can be filled at a time.
3. **Must Have Contact** — The contact field is required (enforced by field-level `required: true`).

## Widget: Team Members Rollup

A new internal widget type (`TeamMembersRollup`) that shows a consolidated, de-duplicated tile view of all contacts and accounts associated with a record.

### Widget Config (Page Editor Properties)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rollupFromProperty` | Boolean | `true` for Property, `false` for others | When on: fetch team members from the current record + the parent Property + all sibling/child objects under that Property. When off: fetch only this record's team members. |
| `label` | String | "Team Members" | Custom widget header label |

### Data Fetching Logic

**Self-only mode (`rollupFromProperty: false`):**
1. Determine which parent Lookup field corresponds to the current object (e.g., on an Opportunity page → `opportunity` field)
2. Fetch: `GET /objects/TeamMember/records?filter[opportunity]={recordId}`

**Rollup mode (`rollupFromProperty: true`):**
1. Get the current record's `property` field value (the Property ID). If the current record IS a Property, use its own ID.
2. Fetch team members for the Property: `filter[property]={propertyId}`
3. Fetch child record IDs: all Opportunities, Projects, WorkOrders, Installations where `property = {propertyId}`
4. Fetch team members for each child type: `filter[opportunity]=id1,id2,...` etc.
5. Run all fetches in parallel.
6. Merge and de-duplicate by Contact ID (and by Account ID for the Accounts column).

### De-duplication & Display Logic

**Contacts column:**
- Group by Contact ID
- Show: Contact name, Account name (if linked), Role, "Associated via" links, Primary/Contract Holder badges
- If the same Contact appears on multiple records, merge their "via" links and aggregate badges
- Only the Team Member record belonging to the current record is editable; others are read-only

**Accounts column:**
- Derived from Team Member records that have an Account filled
- Group by Account ID
- Show: Account name, Role (from team member), "Associated via" links, badges
- If multiple team members share the same Account, show one tile with all "via" links

### Tile Layout

Two-column layout:
- Left column: Contacts (with count)
- Right column: Accounts (with count, derived from Contact data)

Each tile shows:
- Name (clickable, navigates to Contact/Account record)
- Role
- Account name under Contact name (for Contact tiles)
- "via: Record Name" links (clickable, navigate to parent record)
- Primary badge (green)
- Contract Holder badge (orange)

### Actions

- **+ Add Team Member** button — opens a modal dialog to create a new TeamMember record
  - Step 1: Search for a Contact (with typeahead)
  - Step 2: Optionally search/select an Account
  - Step 3: Set Role, Primary, Contract Holder
  - Pre-fills the parent Lookup field based on the current record
- **Inline edit** — on tiles belonging to the current record, allow editing Role, Primary, Contract Holder
- **Remove** — delete the TeamMember junction record (only for current record's team members)

## Widget Registration

Register `TeamMembersRollup` as a new internal widget alongside RelatedList, ActivityFeed, etc.

### Files to Create

```
apps/web/widgets/internal/team-members-rollup/
  ├── index.tsx              # Main widget component
  ├── widget.config.ts       # Widget manifest
  └── ConfigPanel.tsx        # Config panel for Page Editor
```

### Schema Type Addition

Add `TeamMembersRollupConfig` to the `WidgetConfig` union in `apps/web/lib/schema.ts`:

```typescript
export interface TeamMembersRollupConfig {
  type: 'TeamMembersRollup';
  rollupFromProperty?: boolean;
  label?: string;
}
```

### Registry Entry

Add to `apps/web/widgets/internal/registry.ts`:

```typescript
{
  manifest: teamMembersRollupManifest,
  widgetConfigType: 'TeamMembersRollup',
  Component: dynamic(() => import('./team-members-rollup/index')),
  ConfigPanel: TeamMembersRollupConfigPanel,
}
```

## Backend: Object Registration

Add TeamMember to `apps/api/src/ensure-core-objects.ts` following the existing pattern:

```typescript
{
  apiName: 'TeamMember',
  label: 'Team Member',
  pluralLabel: 'Team Members',
  description: 'Junction object linking contacts and accounts to parent records',
  fields: [
    { apiName: 'teamMemberNumber', label: 'Team Member Number', type: 'AutoNumber' },
    { apiName: 'contact', label: 'Contact', type: 'Lookup', required: true },
    { apiName: 'account', label: 'Account', type: 'Lookup' },
    { apiName: 'property', label: 'Property', type: 'Lookup' },
    { apiName: 'opportunity', label: 'Opportunity', type: 'Lookup' },
    { apiName: 'project', label: 'Project', type: 'Lookup' },
    { apiName: 'workOrder', label: 'Work Order', type: 'Lookup' },
    { apiName: 'installation', label: 'Installation', type: 'Lookup' },
    { apiName: 'role', label: 'Role', type: 'Picklist', required: true,
      picklistValues: ['Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer', 'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other'] },
    { apiName: 'primaryContact', label: 'Primary Contact', type: 'Checkbox' },
    { apiName: 'contractHolder', label: 'Contract Holder', type: 'Checkbox' },
    { apiName: 'notes', label: 'Notes', type: 'LongText' },
  ]
}
```

Relationships are automatically created by the existing `ensureFields` logic for Lookup fields.

## Verification

1. **Object exists in Object Manager** — TeamMember appears in the Object Manager with all fields
2. **CRUD works** — Create, read, update, delete TeamMember records via the API
3. **Related Lists work** — Standard Related List widget shows TeamMember records on parent object pages
4. **Rollup widget renders** — TeamMembersRollup widget shows de-duplicated contacts/accounts on Property pages
5. **Self-only mode works** — Widget on Opportunity shows only that Opportunity's team members
6. **Rollup mode works** — Widget on Property (or any object with toggle on) shows full Property tree team members
7. **Add Team Member modal** — Can search for contacts, select account, set role/primary/contract holder, save
8. **Inline edit** — Can edit role/primary/contract holder on current record's team members
9. **Navigation** — Clicking contact/account names navigates to their record; clicking "via" links navigates to parent records
10. **Page Editor** — Widget can be dragged onto any layout; config toggle works in properties panel
