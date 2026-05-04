# Connection Slot Summary Fields & Clickable Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable summary display fields and clickable name navigation to the Connection Slot (TeamMemberSlot) widget's view state.

**Architecture:** Extract a shared record-URL utility used across widgets. Create a new `useDisplayFields` hook that fetches Contact/Account field values for configured display fields. Enhance the read-only view in `TeamMemberSlotField` with Next.js `<Link>` wrappers on names and labeled field rows. Add drag-to-reorder display field configuration in the page editor properties sidebar using the existing dnd-kit pattern.

**Tech Stack:** React, Next.js Link, @dnd-kit/core + @dnd-kit/sortable (already in project), Zustand (editor store), apiClient for data fetching

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/lib/record-url.ts` | Shared `DEDICATED_ROUTES` map + `recordUrl()` helper |
| Create | `apps/web/widgets/internal/team-member-slot/useDisplayFields.ts` | Hook that fetches Contact/Account field values for display |
| Modify | `apps/web/widgets/internal/team-member-slot/TeamMemberSlotField.tsx` | View-state rendering: Link navigation + labeled display field rows |
| Modify | `apps/web/app/object-manager/[objectApi]/page-editor/properties/field-properties.tsx` | Properties sidebar: drag-to-reorder display field config sections |

---

### Task 1: Extract shared record URL utility

**Files:**
- Create: `apps/web/lib/record-url.ts`
- Modify: `apps/web/widgets/internal/related-list/index.tsx` (remove duplicate, import from shared)

`DEDICATED_ROUTES` and `recordUrl()` are duplicated across 4 files. Extract them so TeamMemberSlotField can also build navigation links.

- [ ] **Step 1: Create the shared utility**

Create `apps/web/lib/record-url.ts`:

```typescript
export const DEDICATED_ROUTES: Record<string, string> = {
  Property: '/properties',
  Account: '/accounts',
  Contact: '/contacts',
  Lead: '/leads',
  Opportunity: '/opportunities',
  Project: '/projects',
  Product: '/products',
  Installation: '/installations',
  Quote: '/quotes',
  Service: '/service',
}

export function recordUrl(objectApiName: string, recordId: string, fromPath?: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  const base = prefix ? `${prefix}/${recordId}` : `/objects/${objectApiName}/${recordId}`
  return fromPath ? `${base}?from=${encodeURIComponent(fromPath)}` : base
}
```

- [ ] **Step 2: Update related-list to import from shared utility**

In `apps/web/widgets/internal/related-list/index.tsx`, replace the local `DEDICATED_ROUTES` constant and `recordUrl` function (lines 24-41) with:

```typescript
import { DEDICATED_ROUTES, recordUrl } from '@/lib/record-url'
```

Keep `newRecordUrl` and `listUrl` local — they're only used in this file.

- [ ] **Step 3: Verify the app still compiles**

Run: `cd apps/web && npx next build --no-lint 2>&1 | head -30`

Expected: No import errors. Build progresses past the compilation phase.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/record-url.ts apps/web/widgets/internal/related-list/index.tsx
git commit -m "refactor: extract shared recordUrl utility from related-list"
```

---

### Task 2: Create useDisplayFields hook

**Files:**
- Create: `apps/web/widgets/internal/team-member-slot/useDisplayFields.ts`

This hook fetches Contact and/or Account record field values for the configured `displayFields`. It accepts the TeamMember rows (from `useTeamMemberSlot`) and the `displayFields` config, then returns a map from row ID to fetched field values.

- [ ] **Step 1: Create the hook file**

Create `apps/web/widgets/internal/team-member-slot/useDisplayFields.ts`:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import type { TeamMemberRow } from './useTeamMemberSlot'

interface DisplayFieldValues {
  Contact?: Record<string, unknown>
  Account?: Record<string, unknown>
}

export type DisplayFieldMap = Record<string, DisplayFieldValues>

interface UseDisplayFieldsOptions {
  rows: TeamMemberRow[]
  displayFields?: {
    Contact?: string[]
    Account?: string[]
  }
  enabled: boolean
}

function getLookupId(row: Record<string, unknown>, plainKey: string): string | null {
  const variants = [
    plainKey,
    `${plainKey.charAt(0).toUpperCase()}${plainKey.slice(1)}Id`,
    `TeamMember__${plainKey}`,
  ]
  for (const v of variants) {
    const raw = row[v]
    if (typeof raw === 'string' && raw) return raw
    if (
      raw &&
      typeof raw === 'object' &&
      'id' in raw &&
      typeof (raw as { id: unknown }).id === 'string'
    ) {
      return (raw as { id: string }).id
    }
  }
  return null
}

export function useDisplayFields({
  rows,
  displayFields,
  enabled,
}: UseDisplayFieldsOptions): { fieldMap: DisplayFieldMap; loading: boolean } {
  const [fieldMap, setFieldMap] = useState<DisplayFieldMap>({})
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Record<string, Record<string, unknown>>>({})

  const hasContactFields = (displayFields?.Contact?.length ?? 0) > 0
  const hasAccountFields = (displayFields?.Account?.length ?? 0) > 0
  const hasAnyFields = hasContactFields || hasAccountFields

  useEffect(() => {
    if (!enabled || !hasAnyFields || rows.length === 0) {
      setFieldMap({})
      return
    }

    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      const result: DisplayFieldMap = {}

      await Promise.all(
        rows.map(async (row) => {
          const entry: DisplayFieldValues = {}

          if (hasContactFields) {
            const contactId = getLookupId(row.data, 'contact')
            if (contactId) {
              if (cacheRef.current[contactId]) {
                entry.Contact = cacheRef.current[contactId]
              } else {
                try {
                  const record = await apiClient.get<Record<string, unknown>>(
                    `/objects/Contact/records/${contactId}`,
                  )
                  cacheRef.current[contactId] = record
                  entry.Contact = record
                } catch {
                  /* record may have been deleted */
                }
              }
            }
          }

          if (hasAccountFields) {
            const accountId = getLookupId(row.data, 'account')
            if (accountId) {
              if (cacheRef.current[accountId]) {
                entry.Account = cacheRef.current[accountId]
              } else {
                try {
                  const record = await apiClient.get<Record<string, unknown>>(
                    `/objects/Account/records/${accountId}`,
                  )
                  cacheRef.current[accountId] = record
                  entry.Account = record
                } catch {
                  /* record may have been deleted */
                }
              }
            }
          }

          result[row.id] = entry
        }),
      )

      if (!cancelled) {
        setFieldMap(result)
        setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [rows, displayFields, enabled, hasAnyFields, hasContactFields, hasAccountFields])

  return { fieldMap, loading }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "useDisplayFields" | head -10`

Expected: No type errors referencing this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/widgets/internal/team-member-slot/useDisplayFields.ts
git commit -m "feat: add useDisplayFields hook for connection slot summary data"
```

---

### Task 3: Add clickable navigation + display field rows to view state

**Files:**
- Modify: `apps/web/widgets/internal/team-member-slot/TeamMemberSlotField.tsx`

This is the core UI task. Update the read-only rendering to:
1. Wrap contact/account names in Next.js `<Link>` components
2. Render configured display fields as labeled rows below the names
3. Extract contact/account IDs in `resolveRowDisplay` so links can be built

- [ ] **Step 1: Add new imports**

At the top of `apps/web/widgets/internal/team-member-slot/TeamMemberSlotField.tsx`, add these imports alongside the existing ones:

```typescript
import Link from 'next/link'
import { recordUrl } from '@/lib/record-url'
import { useSchemaStore } from '@/lib/schema-store'
import { useDisplayFields } from './useDisplayFields'
```

- [ ] **Step 2: Update resolveRowDisplay to return IDs**

Replace the `resolveRowDisplay` function (lines 10–29) with a version that also returns the contact and account IDs:

```typescript
function resolveRowDisplay(row: TeamMemberRow): {
  contact: string
  account: string
  contactId: string | null
  accountId: string | null
} {
  const contactId = (row.data.contact as string | undefined)
    ?? (row.data.ContactId as string | undefined)
    ?? (row.data.TeamMember__contact as string | undefined)
    ?? null
  const accountId = (row.data.account as string | undefined)
    ?? (row.data.AccountId as string | undefined)
    ?? (row.data.TeamMember__account as string | undefined)
    ?? null
  const denormContact =
    (row.data.contactName as string | undefined) ||
    (row.data.TeamMember__contactName as string | undefined) ||
    ''
  const denormAccount =
    (row.data.accountName as string | undefined) ||
    (row.data.TeamMember__accountName as string | undefined) ||
    ''
  const contact =
    denormContact || (contactId ? resolveLookupDisplayName(contactId, 'Contact') : '')
  const account =
    denormAccount || (accountId ? resolveLookupDisplayName(accountId, 'Account') : '')
  return {
    contact: contact && contact !== '-' ? contact : '',
    account: account && account !== '-' ? account : '',
    contactId,
    accountId,
  }
}
```

- [ ] **Step 3: Add the useDisplayFields hook call inside the component**

Inside the `TeamMemberSlotField` component, after the existing `useTeamMemberSlot` hook call (line 78), add:

```typescript
const { fieldMap } = useDisplayFields({
  rows,
  displayFields: slotConfig.displayFields,
  enabled: !!readOnly,
})
```

This only fetches when in read-only mode and `displayFields` is configured.

- [ ] **Step 4: Create a helper component for display field rows**

Add this helper component above or below the `resolveRowDisplay` function — it renders labeled rows for one record type:

```typescript
function DisplayFieldRows({
  fields,
  record,
  objectApiName,
}: {
  fields: string[]
  record: Record<string, unknown> | undefined
  objectApiName: string
}) {
  const schema = useSchemaStore((s) => s.schema)
  if (!record || fields.length === 0) return null

  const objectDef = schema?.objects.find((o) => o.apiName === objectApiName)

  return (
    <div className="mt-1 grid gap-x-2 gap-y-0.5 text-xs text-gray-500" style={{ gridTemplateColumns: 'auto 1fr' }}>
      {fields.map((apiName) => {
        const fieldDef = objectDef?.fields.find((f) => f.apiName === apiName)
        const label = fieldDef?.label ?? apiName
        const value = record[apiName]
        const display = value == null || value === '' ? '—' : String(value)
        return (
          <React.Fragment key={apiName}>
            <span className="text-gray-400 font-medium truncate">{label}</span>
            <span className="truncate">{display}</span>
          </React.Fragment>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Replace the read-only rendering block**

Replace the entire `if (readOnly)` block (lines 104–127) with:

```typescript
if (readOnly) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400">—</div>
  }

  const contactDisplayFields = slotConfig.displayFields?.Contact ?? []
  const accountDisplayFields = slotConfig.displayFields?.Account ?? []

  return (
    <div className="text-sm text-gray-900 space-y-2">
      {rows.map((row) => {
        const { contact, account, contactId, accountId } = resolveRowDisplay(row)
        if (!contact && !account) {
          return <div key={row.id} className="text-gray-400 italic">—</div>
        }
        const rowFields = fieldMap[row.id]
        return (
          <div key={row.id}>
            <div>
              {contact && contactId ? (
                <Link href={recordUrl('Contact', contactId)} className="font-medium text-blue-600 underline hover:text-blue-800">
                  {contact}
                </Link>
              ) : contact ? (
                <span className="font-medium">{contact}</span>
              ) : null}
              {contact && account && <span className="text-gray-400 mx-1">&middot;</span>}
              {account && accountId ? (
                <Link href={recordUrl('Account', accountId)} className="text-blue-600 underline hover:text-blue-800">
                  {account}
                </Link>
              ) : account ? (
                <span className="text-gray-700">{account}</span>
              ) : null}
            </div>
            {contactDisplayFields.length > 0 && (
              <DisplayFieldRows
                fields={contactDisplayFields}
                record={rowFields?.Contact}
                objectApiName="Contact"
              />
            )}
            {accountDisplayFields.length > 0 && (
              <DisplayFieldRows
                fields={accountDisplayFields}
                record={rowFields?.Account}
                objectApiName="Account"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -5`

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/widgets/internal/team-member-slot/TeamMemberSlotField.tsx
git commit -m "feat: add clickable navigation and display field rows to connection slot view state"
```

---

### Task 4: Add display fields config to the properties sidebar

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page-editor/properties/field-properties.tsx`

Add drag-to-reorder "Display Fields" sections for Connection Slot fields in the properties sidebar. Uses the existing dnd-kit pattern from `rules-dialog.tsx`.

- [ ] **Step 1: Add new imports**

At the top of `apps/web/app/object-manager/[objectApi]/page-editor/properties/field-properties.tsx`, add these imports:

```typescript
import { GripVertical, X as XIcon, Plus } from 'lucide-react'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FieldDef } from '@/lib/schema'
```

Note: `GripVertical` may already be in scope if lucide-react is imported — check existing imports and merge. Similarly, `FieldDef` may already be imported if used by existing code. Deduplicate as needed.

- [ ] **Step 2: Create the SortableFieldItem component**

Add this component above the main `FieldProperties` export in the same file:

```typescript
function SortableFieldItem({
  apiName,
  label,
  onRemove,
}: {
  apiName: string
  label: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: apiName,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-gray-700">{label}</span>
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create the DisplayFieldsSection component**

Add this component below `SortableFieldItem`:

```typescript
function DisplayFieldsSection({
  title,
  objectApiName,
  selectedFields,
  onChange,
}: {
  title: string
  objectApiName: string
  selectedFields: string[]
  onChange: (fields: string[]) => void
}) {
  const schema = useSchemaStore((s) => s.schema)

  const availableFields: FieldDef[] = useMemo(() => {
    if (!schema) return []
    const obj = schema.objects.find((o) => o.apiName === objectApiName)
    if (!obj) return []
    const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy', 'ownerId'])
    const EXCLUDED_TYPES = new Set(['Lookup', 'ExternalLookup', 'LookupFields', 'LookupUser', 'PicklistLookup', 'AutoNumber', 'Formula', 'RollupSummary', 'AutoUser'])
    return obj.fields.filter(
      (f) => !SYSTEM_FIELDS.has(f.apiName) && !EXCLUDED_TYPES.has(f.type),
    )
  }, [schema, objectApiName])

  const unselectedFields = useMemo(
    () => availableFields.filter((f) => !selectedFields.includes(f.apiName)),
    [availableFields, selectedFields],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = selectedFields.indexOf(String(active.id))
    const newIndex = selectedFields.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(selectedFields, oldIndex, newIndex))
  }

  const handleAdd = (apiName: string) => {
    onChange([...selectedFields, apiName])
  }

  const handleRemove = (apiName: string) => {
    onChange(selectedFields.filter((f) => f !== apiName))
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase text-gray-400">{title}</div>
      {selectedFields.length > 0 ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={selectedFields} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {selectedFields.map((apiName) => {
                const def = availableFields.find((f) => f.apiName === apiName)
                return (
                  <SortableFieldItem
                    key={apiName}
                    apiName={apiName}
                    label={def?.label ?? apiName}
                    onRemove={() => handleRemove(apiName)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] text-gray-400">
          No fields selected
        </div>
      )}
      {unselectedFields.length > 0 && (
        <select
          className="w-full rounded border border-dashed border-gray-300 bg-transparent px-2 py-1.5 text-[11px] text-gray-500"
          value=""
          onChange={(e) => {
            if (e.target.value) handleAdd(e.target.value)
          }}
        >
          <option value="">+ Add {objectApiName.toLowerCase()} field</option>
          {unselectedFields.map((f) => (
            <option key={f.apiName} value={f.apiName}>
              {f.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire the DisplayFieldsSection into the Connection Slot properties**

In the main `FieldProperties` component, find the section that renders when `isSlot` is true (around lines 186-202, the purple box with TeamMemberSlotConfigPanel). Add the display fields sections **after** the closing `</div>` of the purple connection slot box and before the regular field properties (label override, behavior, etc.).

Insert this block:

```typescript
{isSlot && selection.field.slotConfig && (() => {
  const slotMode = (selection.field.slotConfig as TeamMemberSlotConfig).mode ?? 'paired'
  const currentDisplayFields = (selection.field.slotConfig as TeamMemberSlotConfig).displayFields ?? {}
  const showContact = slotMode === 'contact' || slotMode === 'paired'
  const showAccount = slotMode === 'account' || slotMode === 'paired'

  const updateDisplayFields = (patch: { Contact?: string[]; Account?: string[] }) => {
    const next = { ...currentDisplayFields, ...patch }
    updateField(selection.field.fieldApiName, selection.panel.id, {
      slotConfig: {
        ...(selection.field.slotConfig as TeamMemberSlotConfig),
        displayFields: next,
      } as unknown as TeamMemberSlotConfig,
    })
  }

  return (
    <div className="space-y-3 pt-2">
      {showContact && (
        <DisplayFieldsSection
          title="Display Fields — Contact"
          objectApiName="Contact"
          selectedFields={currentDisplayFields.Contact ?? []}
          onChange={(fields) => updateDisplayFields({ Contact: fields })}
        />
      )}
      {showAccount && (
        <DisplayFieldsSection
          title="Display Fields — Account"
          objectApiName="Account"
          selectedFields={currentDisplayFields.Account ?? []}
          onChange={(fields) => updateDisplayFields({ Account: fields })}
        />
      )}
      {!showContact && slotMode === 'account' && (
        <div className="rounded bg-gray-50 px-2 py-1.5 text-center text-[11px] text-gray-400">
          Contact fields not available in account-only mode
        </div>
      )}
      {!showAccount && slotMode === 'contact' && (
        <div className="rounded bg-gray-50 px-2 py-1.5 text-center text-[11px] text-gray-400">
          Account fields not available in contact-only mode
        </div>
      )}
    </div>
  )
})()}
```

- [ ] **Step 5: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | tail -5`

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/[objectApi]/page-editor/properties/field-properties.tsx
git commit -m "feat: add display fields config to connection slot properties sidebar"
```

---

### Task 5: End-to-end verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd apps/web && npm run dev`

- [ ] **Step 2: Verify properties sidebar config**

1. Navigate to Object Manager → pick an object with a Connection Slot field (e.g., Property or Opportunity)
2. Open the page editor
3. Click on a Connection Slot field in the canvas
4. In the properties sidebar, verify:
   - "Display Fields — Contact" section appears (for contact or paired mode slots)
   - "Display Fields — Account" section appears (for account or paired mode slots)
   - "+ Add field" dropdown shows available fields from the Contact/Account object
   - Adding a field puts it in the list with a drag handle and × button
   - Dragging reorders the list
   - Removing a field returns it to the dropdown
5. Save the layout

- [ ] **Step 3: Verify view state rendering**

1. Navigate to a record that has a connection slot with a connection set (e.g., a Property with a Primary Contact)
2. The record detail page should show:
   - Contact name as a blue underlined link
   - Account name (if paired) as a blue underlined link
   - Configured display fields as labeled rows below the name(s)
3. Click the contact name → should navigate to `/contacts/[id]`
4. Go back, click the account name → should navigate to `/accounts/[id]`

- [ ] **Step 4: Verify empty states**

1. View a record with no connection set → should show "—" dash (unchanged)
2. View a record where no display fields are configured → should show just the clickable name(s), no summary rows
3. Verify edit mode → display fields and links should NOT appear (only plain slot inputs)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during verification"
```

Only if changes were needed. Skip if everything works.
