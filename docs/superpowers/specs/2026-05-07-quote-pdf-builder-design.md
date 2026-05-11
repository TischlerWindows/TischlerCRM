# Proposal Builder — Design Spec

## Context

Tischler und Sohn sales reps currently compose 5-page proposals manually for each project. These proposals contain ~22 numbered specification paragraphs, many of which are conditionally included based on product types, glass options, hardware selections, and add-on items. The text is largely boilerplate but varies by project configuration.

This system automates proposal generation by:
1. Storing spec paragraphs as reusable presets with conditional inclusion rules
2. Supporting **variant blocks** — presets whose content changes based on a variable's value (e.g., different glass spec text for glass type #28 vs. #3)
3. Pulling project data from the existing CRM (Opportunity, Account/Contact, Summary)
4. Assembling and rendering a professional PDF matching the Tischler proposal format

An admin builds and manages templates through a dedicated **full-page Proposal Builder UI** — a visual editor with a live letter preview, clickable variable chips, and a variant authoring system. Multiple sales reps then use the templates as a self-service tool to generate proposals from project summaries.

## Data Sources

Summaries are stored as a JSON array in the `Setting` table (key: `"summaries"`), retrieved via `getSetting('summaries')`. Nearly all proposal data comes from the summary object directly.

| Data | Source | Summary Field |
|------|--------|---------------|
| Company name | Summary | `accountReceivingQuote` |
| Company address | Summary | `accountShippingAddress` |
| Contact name | Summary | `contactReceivingQuote` (flat string, e.g., "Matthew Holmes") |
| Contact email | Summary | `contactEmail` |
| Contact phone | Summary | `contactPrimaryPhone` |
| Contact salutation + last name | Contact record (via Opportunity lookup) | Fetch chain: `linkedOpportunityId` → Opportunity `individual_receiving_the_quote.lookup` → Contact `data.name.Contact__name_salutation` / `Contact__name_lastName`. Fallback: parse last word of `contactReceivingQuote` |
| Project name | Summary | `name` |
| Project number | Summary | `opportunityNumber` |
| Today's date | System | `new Date()` formatted |
| Plans Dated | Summary | `plansDated` (ISO date string) |
| Job type | Summary | `jobType` (e.g., "Dade County") |
| Product types | Summary | `rows[].type` / `doorRows[].type` (exact type names from WINDOW_TYPES and DOOR_TYPES constants) |
| Wood type | Summary | `woodType` (e.g., "Sipo") |
| Glass type | Summary | `glassType` (e.g., `28 DC Standard Insulated "LowE"`) |
| SDL/muntin type | Summary | `sdl` + `muntinType` (e.g., "22MM" / "SDL") |
| Spacer bar type | Summary | `spacerBarType` (e.g., "Aluminum Spacer") |
| Spacer bar colors | Summary | `spacerBarColors` (e.g., "Standard White, Silver, Brown, Black") |
| Finish type | Summary | `finish` — parse trailing number (e.g., "200" from "Same finish inside and out (paint/paint or stain/stain) 200") |
| Hardware options | Summary | `productTypeOptions` — `Record<string, string[]>` mapping product type names to selected options |
| Category pricing | Summary | `quoteTotals.{euroWindows,doubleHung,euroDoors}.finalAdj` — whole dollar amounts as strings (e.g., "87600" = $87,600) |
| Base Bid Price (grand total) | Summary | `sum(quoteTotals.*.finalAdj) + grandTotalAdjustment.finalAdj` |
| Add-on items + prices | Summary | `addOns.{windowScreens,doorScreenSash,entryDoor,jambExtensions,magneticContact,finalFinish,installation}.final` |
| Salesman / Estimator | Summary | `salesman` / `estimator` |
| Project address | Summary | `address` |
| Proposal/quote type | Summary | `quoteType` ("first" or "requote") |

## Data Model

Five Prisma models in `packages/db/prisma/schema.prisma`:

### QuoteTemplate

Groups spec presets into a named template.

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| name | String | Template name (e.g., "Standard Proposal") |
| description | String? | Optional description |
| isDefault | Boolean | Whether this is the default template |
| isActive | Boolean | Whether available for use |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| presets | SpecPreset[] | Related presets |

### SpecPreset

A single block in the proposal — either a simple text block or a variant block with multiple content versions.

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| templateId | String | FK to QuoteTemplate |
| order | Int | Display position in the letter |
| title | String | Admin-facing label (e.g., "Glass Specifications") |
| body | String? | Full paragraph text with `{{token}}` placeholders. **Null when driverField is set** (content lives in variants instead). |
| section | Enum | SPECIFICATION, OPTION, EXCLUSION, INSTALLATION, CONSTANT |
| driverField | String? | **NEW.** When set, this block has value-dependent content. The field name references a context field (e.g., "glassType", "jobType", "productTypes"). When null, block uses `body` directly. |
| isAlwaysIncluded | Boolean | If true, skip condition evaluation — always include |
| isActive | Boolean | Whether this preset is available |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| conditions | SpecCondition[] | Related conditions |
| variants | SpecVariant[] | Related variants (only used when driverField is set) |

### SpecVariant (NEW)

A single content version of a variant block, keyed to a specific value of the parent preset's driver field.

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| presetId | String | FK to SpecPreset |
| matchValue | String | Value to match against the driver field (e.g., "#28", "Dade County", "Double Hung Concealed Balance") |
| matchLabel | String? | Friendly display name for admin UI (e.g., "Dade County Impact Glass"). Not used in matching. |
| body | String | Full paragraph text with `{{token}}` placeholders |
| order | Int | Display order when multiple variants match in one proposal |
| isActive | Boolean | Whether this variant is available |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### SpecCondition

A single rule that determines if a preset is included.

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| presetId | String | FK to SpecPreset |
| field | String | Context field to evaluate (e.g., "productTypes", "glassType", "hasInstallation") |
| operator | Enum | CONTAINS, EQUALS, NOT_EMPTY, IS_TRUE, IS_FALSE |
| value | String? | Value to match against (null for IS_TRUE/IS_FALSE/NOT_EMPTY) |
| logic | Enum | AND, OR — how this combines with other conditions on the same preset |

### TokenMapping (NEW)

Stores token-to-field mappings. Built-in tokens are seeded; admins create custom tokens through the UI via a cascading dropdown (pick object → pick field).

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| templateId | String | FK to QuoteTemplate |
| tokenName | String | The token identifier used inside `{{...}}` (e.g., "projectName", "customGlassNote") |
| sourceObject | Enum | SUMMARY, CONTACT, ACCOUNT, OPPORTUNITY, SYSTEM — which object the value comes from |
| sourcePath | String | Dot-notation field path within the source object (e.g., "name", "quoteTotals.euroWindows.finalAdj", "data.name.Contact__name_salutation") |
| format | Enum | TEXT, CURRENCY, DATE, PHONE, PERCENTAGE — how to format the resolved value |
| label | String | Friendly display name shown in the variable chips panel (e.g., "Project Name") |
| category | String | Which chip group it appears in (Project, Materials, People, Pricing, Add-ons, Date, Custom) |
| isBuiltIn | Boolean | True for the ~30 default tokens (seeded). Built-ins cannot be deleted but can be edited. |
| isActive | Boolean | Whether this token appears in the chips panel |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Source objects and their available fields:**

| Source Object | How Fields Are Discovered | Examples |
|--------------|--------------------------|----------|
| Summary | Static schema definition (known shape) | `name`, `glassType`, `woodType`, `quoteTotals.euroWindows.finalAdj`, `addOns.magneticContact.final` |
| Contact | Hardcoded common fields (V1) | `data.name.Contact__name_salutation`, `data.name.Contact__name_lastName`, `data.Contact__email` |
| Account | Hardcoded common fields (V1) | `data.Account__name`, `data.Account__shipping_address` |
| Opportunity | Hardcoded common fields (V1) | `data.Opportunity__name`, `data.Opportunity__number` |
| System | Computed values | `todayDate` (only option in V1) |

**Creating a custom token (UI flow):**
1. Click "+ New Variable" in the variable chips panel
2. **Step 1:** Select source object from dropdown (Summary, Contact, Account, Opportunity, System)
3. **Step 2:** Select field from filtered dropdown (shows only fields available on the selected object)
4. **Step 3:** Enter token name, pick display format (text/currency/date/phone), assign to a chip category
5. Save — token appears as a new chip in the panel, immediately usable in `{{tokenName}}` placeholders

**Token resolution at render time:**
The placeholder resolver reads all active TokenMapping records for the template, then for each token:
1. Look up the `sourceObject` to get the data source (summary object, fetched Contact record, etc.)
2. Navigate the `sourcePath` to extract the raw value
3. Apply the `format` transform (e.g., CURRENCY: `parseInt("87600").toLocaleString('en-US', {style: 'currency', currency: 'USD'})`)
4. Replace `{{tokenName}}` in the text

### Block types

Every block has two independent axes:

**Content axis:**
- **Simple block** (`driverField = null`): One `body` field with `{{token}}` placeholders. Covers static text, token substitution, and boilerplate.
- **Variant block** (`driverField` set): Multiple `SpecVariant` records, each with a `matchValue` and its own `body`. At render time, the system checks the driver field's value(s) in the project and outputs all matching variants.

**Inclusion axis:**
- **Always included** (`isAlwaysIncluded = true`): Conditions bypassed.
- **Conditional** (`isAlwaysIncluded = false`, conditions present): Evaluated against project context.
- **Excluded** (`isAlwaysIncluded = false`, no conditions): Never included.

These axes are orthogonal — a variant block can be always-included or conditional.

### Condition evaluation rules

- If `isAlwaysIncluded` is true, conditions are ignored — preset is always included
- If a preset has no conditions and `isAlwaysIncluded` is false, it is excluded
- When conditions exist: group them by logic type. All AND conditions must pass. If any OR conditions exist, at least one must pass. Both groups must be satisfied: `(all ANDs pass) && (any OR passes)`.

### Variant matching rules

- When `driverField` is set, the system looks up the driver field's value(s) in the project context
- Some driver fields produce a single value (e.g., `glassType` = "#28") — match one variant
- Some driver fields produce multiple values (e.g., `productTypes` = ["Double Hung", "Outswing GD", "Lift & Roll"]) — match multiple variants, output all in `order`
- A project can also have multiple glass types — all matching variants output
- Matching uses string containment: the project value must contain the variant's `matchValue`
- Unmatched variants are silently skipped (no error)

### Available placeholder tokens

Tokens are stored in the `TokenMapping` table, not hardcoded. The seed data creates ~30 built-in tokens covering the standard proposal fields. Admins can create additional custom tokens through the UI.

**Built-in tokens (seeded):**

| Token | Source Object | Source Path | Format | Category |
|-------|-------------|-------------|--------|----------|
| `projectName` | Summary | `name` | TEXT | Project |
| `projectNumber` | Summary | `opportunityNumber` | TEXT | Project |
| `plansDated` | Summary | `plansDated` | DATE | Project |
| `jobType` | Summary | `jobType` | TEXT | Project |
| `address` | Summary | `address` | TEXT | Project |
| `quoteType` | Summary | `quoteType` | TEXT | Project |
| `glassType` | Summary | `glassType` | TEXT | Materials |
| `woodType` | Summary | `woodType` | TEXT | Materials |
| `finishType` | Summary | `finish` | TEXT | Materials |
| `sdlType` | Summary | `sdl` | TEXT | Materials |
| `spacerBarColor` | Summary | `spacerBarColors` | TEXT | Materials |
| `spacerBarType` | Summary | `spacerBarType` | TEXT | Materials |
| `contactName` | Summary | `contactReceivingQuote` | TEXT | People |
| `contactSalutation` | Contact | `data.name.Contact__name_salutation` | TEXT | People |
| `contactLastName` | Contact | `data.name.Contact__name_lastName` | TEXT | People |
| `contactEmail` | Summary | `contactEmail` | TEXT | People |
| `contactPhone` | Summary | `contactPrimaryPhone` | PHONE | People |
| `companyName` | Summary | `accountReceivingQuote` | TEXT | People |
| `companyAddress` | Summary | `accountShippingAddress` | TEXT | People |
| `salesman` | Summary | `salesman` | TEXT | People |
| `estimator` | Summary | `estimator` | TEXT | People |
| `euroWindowsPrice` | Summary | `quoteTotals.euroWindows.finalAdj` | CURRENCY | Pricing |
| `doubleHungPrice` | Summary | `quoteTotals.doubleHung.finalAdj` | CURRENCY | Pricing |
| `euroDoorsPrice` | Summary | `quoteTotals.euroDoors.finalAdj` | CURRENCY | Pricing |
| `grandTotal` | System | `grandTotal` | CURRENCY | Pricing |
| `magneticContactPrice` | Summary | `addOns.magneticContact.final` | CURRENCY | Add-ons |
| `magneticContactQty` | Summary | `addOns.magneticContact.qty` | TEXT | Add-ons |
| `finalFinishPrice` | Summary | `addOns.finalFinish.final` | CURRENCY | Add-ons |
| `installationPrice` | Summary | `addOns.installation.final` | CURRENCY | Add-ons |
| `todayDate` | System | `todayDate` | DATE | Date |

## Conditions Engine

When generating a quote, the system builds a context object from the summary + opportunity data:

```
{
  productTypes: ["Double Hung", "Outswing Casement", "Garden Door", "Lift & Roll"],
  glassType: "#28",
  jobType: "Dade County Impact",
  hasWindows: true,
  hasDoors: true,
  hasDoubleHung: true,
  hasGardenDoor: true,
  hasLiftRoll: true,
  hasOutswing: true,
  finishType: "200",
  woodType: "Sipo",
  sdlType: "Sprosse 22",
  spacerBarColor: "black",
  spacerBarType: "Aluminum",
  hardwareOptions: ["KFV RH", "Corrosion Resistance RH", "SS RH"],
  addOnItems: ["Magnetic Alarm Contacts", "Final Finish", "Installation"],
  hasInstallation: true,
  hasMagneticContacts: true,
  hasFinalFinish: true,
  plansDated: "8/15/2025",
}
```

The engine iterates each SpecPreset in order:
1. Evaluate conditions → include or exclude the block
2. If included and `driverField` is null → resolve tokens in `body`, output one paragraph
3. If included and `driverField` is set → look up driver field value(s) in context → find matching SpecVariants → resolve tokens in each variant's `body` → output all matches in order

## Proposal Builder UI

### Overview

The Proposal Builder is a **dedicated full-page route** (not a settings sub-page). It opens as its own page, similar to the existing Page Builder pattern. Accessed via a link in Settings or directly from the Opportunity page.

**Route:** `/settings/quote-builder` (existing path, but renders as full-page layout — hides the settings sidebar and uses the full viewport)

### Layout: Three-panel with top bar

**Top bar** (navy `#1e3a5f`):
- ← Back to Settings
- Template selector dropdown
- Summary selector dropdown (for live preview context)
- Preview PDF button
- Save button

**Left panel** (220px, fixed):
- **Top section: Block list** — ordered list of all blocks in the template. Each shows: title, section badge (Constant/Spec/Option/Exclusion/Installation), variant indicator (🔀 icon if driverField is set), condition count. Drag-to-reorder. Click to select for editing. "+ New Block" button at bottom.
- **Bottom section: Variable chips** — pulled from `TokenMapping` records for the active template, grouped by `category`. Click a chip to insert `{{tokenName}}` at the cursor in whichever body textarea is focused. **"+ New Variable" button** at the bottom opens the custom token creation flow (cascading dropdown: pick object → pick field → name + format).

**Center panel** (flex, scrollable):
- **Live letter preview** — HTML rendering of the full proposal letter (letterhead, date, addressee, salutation, numbered specs, pricing, options, exclusions, closing).
- The currently-edited block has a blue highlight border + "Editing: {title}" label. Other blocks are dimmed.
- `{{tokens}}` render as colored chips showing the token name (no summary selected) or resolved values (summary selected).
- **Variant blocks without a summary selected**: Show all variants stacked with labels (e.g., "variant: #28", "variant: #3") and a note: "Select a summary to see matched output."
- **Variant blocks with summary selected**: Only matching variants render, showing what the actual proposal would look like.
- Clicking a block in the preview selects it in the editor.

**Right panel** (300px, fixed):
- **Block editor** — adapts based on block type:

### Simple block editor (driverField = null)

- Title field
- Section pills: Constant, Specification, Option, Exclusion, Installation (with friendly labels and descriptions on hover)
- Driver Variable dropdown (set to "None")
- Body textarea with `{{token}}` inline highlighting
- "Always included" toggle with helper text
- Active toggle
- Conditions builder (rows of logic + field + operator + value)
- Save / Delete buttons

### Variant block editor (driverField set)

- Title field
- Section pills
- Driver Variable dropdown (selected value shown with amber highlight, "✕ Clear" button)
- Helper text: "Content varies by {driver} value — add a variant for each type"
- **Variant list**:
  - Each variant card shows: match value badge (monospace), match label, body textarea with `{{token}}` highlighting, active toggle, remove button
  - The currently-edited variant has a blue border (expanded). Others are collapsed (click to expand).
  - "+ Add Variant" button at bottom
- "Always included" toggle (controls the whole block, not individual variants)
- Active toggle
- Conditions builder
- Save / Delete buttons

### Switching between modes

When the admin selects a driver variable from the dropdown:
- The single body textarea is replaced by the variant list
- If there was existing body text, it becomes the first variant (matchValue blank, body preserved)

When the admin clears the driver variable:
- The variant list collapses back to a single body textarea
- The first variant's body text is used as the single body
- Other variants are preserved in the database but hidden (can be recovered by re-selecting the driver)

### Section labels

Raw enum names are replaced with friendly labels throughout the UI:

| Enum | Label | Description |
|------|-------|-------------|
| CONSTANT | Constant | Always appears in the proposal — intro and closing text |
| SPECIFICATION | Specification | Numbered paragraphs describing materials, hardware, and terms |
| OPTION | Option | Add-on items with pricing (magnetic contacts, final finish, etc.) |
| EXCLUSION | Exclusion | Items NOT included in the base bid |
| INSTALLATION | Installation | Installation scope, terms, and pricing (separate page) |

### Variable chip categories

Chips are dynamically generated from `TokenMapping` records. Built-in tokens are seeded into these default categories; custom tokens can be assigned to any category (including a new "Custom" category).

| Category | Built-in Tokens (seeded) |
|----------|-------------------------|
| Project | projectName, projectNumber, plansDated, jobType, address, quoteType |
| Materials | glassType, woodType, finishType, sdlType, spacerBarColor, spacerBarType |
| People | contactName, contactSalutation, contactLastName, contactEmail, contactPhone, companyName, companyAddress, salesman, estimator |
| Pricing | euroWindowsPrice, doubleHungPrice, euroDoorsPrice, grandTotal |
| Add-ons | magneticContactPrice, magneticContactQty, finalFinishPrice, installationPrice |
| Date | todayDate |
| Custom | (empty — populated by admin-created tokens) |

### Available driver fields

The admin selects from a curated list of fields that can drive variant content:

| Driver Field | Context Source | Value Type |
|-------------|---------------|------------|
| glassType | `summary.glassType` | Single value (but project may have multiple) |
| jobType | `summary.jobType` | Single value |
| productTypes | `summary.rows[].type` + `summary.doorRows[].type` | Multiple values |
| woodType | `summary.woodType` | Single value |
| finishType | Parsed from `summary.finish` | Single value |
| spacerBarType | `summary.spacerBarType` | Single value |
| sdlType | `summary.sdl` | Single value |

## Proposal Structure

The assembled PDF follows this fixed section order:

1. **Letterhead** — Tischler logo + company address (always)
2. **Date** — Today's date (always)
3. **Addressee block** — Contact name, company, address from linked Account/Contact (always)
4. **Salutation** — "Dear Mr./Ms. {lastName}:" (always)
5. **Opening paragraph** — CONSTANT section preset(s) before specs
6. **Base Bid paragraph** — Standard boilerplate about quantities/sizes
7. **Numbered specifications** — All included SPECIFICATION presets, rendered in `order` sequence. Variant blocks output all matching variants as consecutive paragraphs under the same spec number.
8. **Category pricing breakdown** — Double Hungs, Euro Windows, Doors from Final W/ADJ column
9. **BASE BID PRICE** — Grand total
10. **Options section** — "ADDITIONS OR DEDUCTIONS TO OUR BASE BID" — included OPTION presets with prices from add-on items
11. **Exclusions** — "Our Base Bid does not include:" — included EXCLUSION presets
12. **Closing** — CONSTANT section preset(s) after specs (matched by title regex `/closing|signature|sincerely/i`)
13. **Installation page** — Conditional on installation being an add-on item. Includes installation cost breakdown + INSTALLATION presets

## API Routes

### quote-templates.ts
- `GET /quote-templates` — List all templates
- `GET /quote-templates/:id` — Get template with presets, conditions, and variants
- `POST /quote-templates` — Create template
- `PATCH /quote-templates/:id` — Update template
- `DELETE /quote-templates/:id` — Delete template

### spec-presets.ts
- `GET /spec-presets?templateId=X` — List presets for a template (with variants)
- `POST /spec-presets` — Create preset with conditions and variants
- `PATCH /spec-presets/:id` — Update preset, replace conditions and variants
- `DELETE /spec-presets/:id` — Delete preset (cascades conditions and variants)
- `PATCH /spec-presets/reorder` — Batch update preset order values

### spec-variants.ts (NEW)
- `POST /spec-variants` — Create variant for a preset
- `PATCH /spec-variants/:id` — Update variant
- `DELETE /spec-variants/:id` — Delete variant

### token-mappings.ts (NEW)
- `GET /token-mappings?templateId=X` — List all token mappings for a template (grouped by category)
- `POST /token-mappings` — Create custom token mapping
- `PATCH /token-mappings/:id` — Update token mapping (only custom tokens, not built-ins)
- `DELETE /token-mappings/:id` — Delete custom token mapping (built-ins cannot be deleted)

## File Locations

| Component | Path |
|-----------|------|
| Prisma models | `packages/db/prisma/schema.prisma` |
| Quote template API routes | `apps/api/src/routes/quote-templates.ts` |
| Spec preset API routes | `apps/api/src/routes/spec-presets.ts` |
| Spec variant API routes | `apps/api/src/routes/spec-variants.ts` (new) |
| Token mapping API routes | `apps/api/src/routes/token-mappings.ts` (new) |
| Proposal Builder page | `apps/web/app/settings/quote-builder/page.tsx` |
| Settings sidebar | `apps/web/components/settings/settings-sidebar.tsx` |
| Conditions engine | `apps/web/lib/quote-conditions.ts` |
| Proposal assembly | `apps/web/lib/proposal-assembly.ts` |
| Placeholder resolver | `apps/web/lib/quote-placeholders.ts` |
| PDF renderer | `apps/web/lib/quote-pdf-renderer.ts` |

## Seed Data

V1 ships with a pre-populated "Standard Proposal" template. Simple blocks use `body` directly. Variant blocks use `driverField` + `SpecVariant` records. Initial seed covers the Little Club Road reference proposal structure with glass type #28 as the first variant.

Additional variants (glass types #3, #6, #18, etc.) are added by the admin through the UI after deployment.

## V1 Scope

**In:**
- Prisma models + migration (QuoteTemplate, SpecPreset with driverField, SpecVariant, SpecCondition, TokenMapping)
- CRUD API routes for templates, presets, variants, conditions, token mappings
- Full-page Proposal Builder UI with three-panel layout
- Simple block editor (single body textarea)
- Variant block editor (driver variable + variant list)
- Live letter preview with variant awareness
- Clickable variable chips for token insertion
- Friendly section labels with descriptions
- Condition evaluation engine
- Variant matching engine
- Placeholder token resolution
- Proposal PDF generation
- Custom token creation UI (cascading dropdown: object → field → name + format)
- Seed data for Standard Proposal (glass type #28 variant) + ~30 built-in token mappings

**Out (future):**
- Inline text editing of assembled quotes before export
- Elevation pages (6-8)
- Quote versioning / history
- Multiple template support (UI for creating/switching templates)
- Email integration
- Saved/archived generated PDFs
- Metal job templates (different base template)

## Verification

1. **Admin page:** Navigate to Proposal Builder. Create simple blocks and variant blocks. Verify conditions and variants save and load correctly.
2. **Variant editor:** Set a driver variable on a block. Add variants with match values and body text. Verify switching between simple and variant modes preserves data.
3. **Live preview:** Select a summary from the dropdown. Verify variant blocks show only matching variants. Verify token chips resolve to actual values.
4. **Variable chips:** Click a chip from the left panel. Verify `{{token}}` is inserted at cursor in the active body textarea (works for both simple body and variant body).
5. **Condition engine:** Unit test with mock context objects. Verify AND/OR logic, variant matching, placeholder resolution.
6. **PDF generation:** Generate a proposal PDF from a summary with multiple product types + glass type #28. Verify variant blocks output correct content. Compare against reference PDF structure.
7. **Edge cases:** Summary with only windows (no doors) — door-specific specs excluded. Variant block with no matching variants — block silently skipped. Summary with multiple glass types — multiple variant paragraphs output.
