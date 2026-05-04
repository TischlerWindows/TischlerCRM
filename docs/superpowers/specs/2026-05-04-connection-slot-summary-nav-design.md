# Connection Slot: Summary Display Fields & Clickable Navigation

## Context

The Connection Slot (TeamMemberSlot) widget currently shows only plain-text contact/account names in view mode with no additional information and no way to navigate to the linked record. Users need quick access to key contact/account details (email, phone, etc.) directly from the parent record page, and the ability to click through to the full contact or account record.

## Features

### Feature 1: Summary Display Fields

Show configurable summary fields (email, phone, title, etc.) below the contact/account name in the connection slot's view state.

**View State Rendering (Labeled Rows):**
- Below the contact/account name, display each configured field as a labeled row
- Layout: two-column grid — small muted label on the left, value on the right
- Fields are display-only (not actionable — no mailto: or tel: links)
- Field order matches the configured order in the properties sidebar

**Mode Adaptation:**
- Contact-only mode: shows only Contact display fields
- Account-only mode: shows only Account display fields
- Paired mode: shows Contact fields (fields from the linked contact) and/or Account fields (fields from the linked account), depending on what's configured

**Multi-Cardinality:**
- For multi-cardinality slots (multiple connections), each row shows its own display fields
- The same `displayFields` config applies to every row in the slot

**Fallback Behavior:**
- No display fields configured: shows only the clickable name(s) — equivalent to current behavior but with navigation links
- No connection set: shows a dash (—) placeholder — unchanged from current

### Feature 2: Clickable Name Navigation

Contact and account names become navigable links to their respective record detail pages.

**Behavior:**
- Contact name links to `/contacts/[contactId]`
- Account name links to `/accounts/[accountId]`
- In paired mode, both names are independently clickable
- Standard link styling: blue text, underlined
- Uses Next.js `<Link>` for client-side navigation

## Architecture

### Data Flow

1. `TeamMemberSlotConfig.displayFields` specifies which fields to show: `{ Contact?: string[], Account?: string[] }`
2. `useTeamMemberSlot` hook loads TeamMember rows (existing behavior)
3. When `displayFields` is configured AND a connection exists, a secondary fetch retrieves the specified fields from the Contact and/or Account record
4. View state component renders the name links + labeled field rows

### Config Schema (Existing — No Changes Needed)

```typescript
// Already defined in lib/schema.ts
interface TeamMemberSlotConfig {
  type: 'TeamMemberSlot';
  label?: string;
  criterion: TeamMemberSlotCriterion;
  cardinality: 'single' | 'multi';
  mode: 'contact' | 'account' | 'paired';
  displayFields?: {
    Contact?: string[];  // Ordered list of Contact field apiNames
    Account?: string[];  // Ordered list of Account field apiNames
  };
  placeholder?: string;
}
```

### Components Modified

| File | Change |
|------|--------|
| `widgets/internal/team-member-slot/TeamMemberSlotField.tsx` | Enhance read-only rendering: add Link wrappers on names, render labeled field rows |
| `widgets/internal/team-member-slot/useTeamMemberSlot.ts` | Add secondary fetch for display field values when `displayFields` is configured |
| `app/object-manager/[objectApi]/page-editor/properties/field-properties.tsx` | Add "Display Fields" drag-to-reorder sections for teamMemberSlot fields |

### Properties Sidebar Configuration

**UI:** Drag-to-reorder list in the field properties panel when a teamMemberSlot field is selected.

**Sections (conditional on slot mode):**
- "Display Fields — Contact" (shown in contact-only and paired modes)
- "Display Fields — Account" (shown in account-only and paired modes)

**Controls:**
- Each section has an "+ Add field" button that opens a dropdown of available fields from the respective object schema
- Added fields appear as reorderable list items with a drag handle and remove (×) button
- Available fields are sourced from the Contact/Account object schema (all field types except Lookup and system fields)

**State update:** Changes write to `slotConfig.displayFields` on the PanelField via the existing `updateField` action in the layout store.

### Data Fetching Strategy

- Extend `useTeamMemberSlot` to accept `displayFields` config
- After resolving the TeamMember row(s), if display fields are configured:
  - Extract the `contact` and/or `account` IDs from the TeamMember row
  - Fetch the specified fields via `GET /objects/Contact/records/[id]` and/or `GET /objects/Account/records/[id]`
  - Return the field values alongside the existing TeamMember data
- Fetch is skipped when `displayFields` is empty/undefined or no connection is set
- Data is cached per record ID to avoid redundant fetches across re-renders

## Verification

1. **Properties Sidebar:** Open page editor → select a Connection Slot field → verify "Display Fields" sections appear based on mode → add/remove/reorder fields → save layout
2. **View State — Contact Only:** Configure display fields on a contact-only slot → view a record with a connection → verify labeled rows appear below clickable contact name
3. **View State — Account Only:** Same test with account-only slot
4. **View State — Paired:** Configure both Contact and Account display fields → verify both sets render
5. **Navigation:** Click contact name → navigates to `/contacts/[id]` → click back → click account name → navigates to `/accounts/[id]`
6. **Empty States:** Remove all display fields config → verify slot shows only clickable names. Clear the connection → verify dash placeholder.
7. **Edit Mode:** Verify display fields and navigation links do NOT appear in edit mode (only view/read-only state)
