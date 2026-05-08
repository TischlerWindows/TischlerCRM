# Proposal Builder — Design Spec

## Context

Tischler und Sohn sales reps currently compose 5-page proposals manually for each project. These proposals contain ~22 numbered specification paragraphs, many of which are conditionally included based on product types, glass options, hardware selections, and add-on items. The text is largely boilerplate but varies by project configuration.

This system automates proposal generation by:
1. Storing spec paragraphs as reusable presets with conditional inclusion rules
2. Pulling project data from the existing CRM (Opportunity, Account/Contact, Summary)
3. Assembling and rendering a professional PDF matching the Tischler proposal format

Multiple sales reps will use this as a self-service tool. An admin manages the spec presets centrally.

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
| Hardware options | Summary | `productTypeOptions` — `Record<string, string[]>` mapping product type names to selected options (e.g., `{"Outswing GD": ["72mm Thick Sash", "Corrosion Resistance RH", "KFV RH"]}`) |
| Category pricing | Summary | `quoteTotals.{euroWindows,doubleHung,euroDoors}.finalAdj` — **whole dollar amounts as strings** (e.g., "87600" = $87,600) |
| Base Bid Price (grand total) | Summary | `sum(quoteTotals.*.finalAdj) + grandTotalAdjustment.finalAdj` |
| Add-on items + prices | Summary | `addOns.{windowScreens,doorScreenSash,entryDoor,jambExtensions,magneticContact,finalFinish,installation}.final` |
| Salesman / Estimator | Summary | `salesman` / `estimator` |
| Project address | Summary | `address` |
| Proposal/quote type | Summary | `quoteType` ("first" or "requote") |

## Data Model

Three new Prisma models in `packages/db/prisma/schema.prisma`:

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

A single spec paragraph with its display position and conditions.

| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID |
| templateId | String | FK to QuoteTemplate |
| order | Int | Display position in the letter |
| title | String | Admin-facing label (e.g., "Impact Glass Specifications") |
| body | String | Full paragraph text with `{{token}}` placeholders |
| section | Enum | SPECIFICATION, OPTION, EXCLUSION, INSTALLATION, ALWAYS |
| isAlwaysIncluded | Boolean | If true, skip condition evaluation — always include |
| isActive | Boolean | Whether this preset is available |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| conditions | SpecCondition[] | Related conditions |

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

### Condition evaluation rules

- If `isAlwaysIncluded` is true, conditions are ignored — preset is always included
- If a preset has no conditions and `isAlwaysIncluded` is false, it is excluded
- When conditions exist: group them by logic type. All AND conditions must pass. If any OR conditions exist, at least one must pass. Both groups must be satisfied: `(all ANDs pass) && (any OR passes)`.
- Example: conditions [AND: hasDoors, AND: hasGardenDoor, OR: KFV RH, OR: Corrosion Resistance RH] means: the job must have doors AND garden doors, AND must have either KFV RH or Corrosion Resistance RH.

### Available placeholder tokens

| Token | Source | Example value |
|-------|--------|---------------|
| `{{projectName}}` | `summary.name` | "Little Club Road #1" |
| `{{projectNumber}}` | `summary.opportunityNumber` | "OPP0018" |
| `{{plansDated}}` | `summary.plansDated` (formatted) | "8/15/2025" |
| `{{jobType}}` | `summary.jobType` | "Dade County" |
| `{{glassType}}` | `summary.glassType` | `28 DC Standard Insulated "LowE"` |
| `{{finishType}}` | Parsed from `summary.finish` | "200" |
| `{{sdlType}}` | `summary.sdl` / `summary.sdlCustom` | "22MM" |
| `{{spacerBarColor}}` | `summary.spacerBarColors` | "Standard White, Silver, Brown, Black" |
| `{{woodType}}` | `summary.woodType` | "Sipo" |
| `{{contactName}}` | `summary.contactReceivingQuote` | "Matthew Holmes" |
| `{{contactSalutation}}` | Contact record (fetched) | "Mr." |
| `{{contactLastName}}` | Contact record or parsed from name | "Holmes" |
| `{{companyName}}` | `summary.accountReceivingQuote` | "Tim Givens Building & Remodeling" |
| `{{address}}` | `summary.address` | "1 Little Club Road, Delray Beach, FL, 33483" |
| `{{salesman}}` | `summary.salesman` | "Jim" |
| `{{estimator}}` | `summary.estimator` | "Julian" |
| `{{todayDate}}` | System | "January 23, 2026" |

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
  sdlType: "Sprosse 22",
  spacerBarColor: "black",
  hardwareOptions: ["KFV RH", "Corrosion Resistance RH", "SS RH"],
  addOnItems: ["Magnetic Alarm Contacts", "Final Finish", "Installation"],
  hasInstallation: true,
  hasMagneticContacts: true,
  hasFinalFinish: true,
  plansDated: "8/15/2025",
  // ... pricing values for placeholder resolution
}
```

The engine iterates each SpecPreset in order, evaluates its conditions against this context, and produces an ordered list of included presets with resolved placeholder text.

## Proposal Structure

The assembled PDF follows this fixed section order:

1. **Letterhead** — Tischler logo + company address (always)
2. **Date** — Today's date (always)
3. **Addressee block** — Contact name, company, address from linked Account/Contact (always)
4. **Salutation** — "Dear Mr./Ms. {lastName}:" (always)
5. **Opening paragraph** — Standard text with project name, project number, Plans Dated (always)
6. **Base Bid paragraph** — Standard boilerplate about quantities/sizes (always)
7. **Numbered specifications** — All included SPECIFICATION presets, rendered in `order` sequence
8. **Category pricing breakdown** — Double Hungs, Euro Windows, Doors from Final W/ADJ column
9. **BASE BID PRICE** — Grand total
10. **Options section** — "ADDITIONS OR DEDUCTIONS TO OUR BASE BID" — included OPTION presets with prices from add-on items
11. **Exclusions** — "Our Base Bid does not include:" — included EXCLUSION presets
12. **Closing** — Standard text + signature (always)
13. **Installation page** — Conditional on installation being an add-on item. Includes installation cost breakdown + INSTALLATION presets (terms, exclusions, final adjustments note)

## Admin UI

Settings sub-page at `/settings/quote-builder` with split-view layout (added to Settings sidebar "Automation" group):

**Left panel — Preset list:**
- Template selector dropdown at top
- Scrollable list of presets showing: order number, title, section type, condition count, active status
- Drag-to-reorder for changing display order
- "+ New" button for creating presets
- Color-coded status indicators (green = active with conditions, purple = always included, red = inactive)

**Right panel — Preset editor:**
- Title field
- Section type selector (SPECIFICATION, OPTION, EXCLUSION, INSTALLATION, ALWAYS)
- Body text editor with `{{token}}` placeholder highlighting
- "Always included" toggle (bypasses conditions)
- Condition builder: rows of (logic AND/OR) + (field dropdown) + (operator dropdown) + (value input)
- Add/remove condition buttons
- Save, Preview, Delete actions

## PDF Generation

Extends the existing client-side jsPDF implementation in `apps/web/app/summary/page.tsx`.

New function `handleGenerateQuotePDF(mode: 'download' | 'preview')` that:

1. Fetches the active QuoteTemplate with presets + conditions via API
2. Gathers context from summary state + fetches Opportunity/Account/Contact data
3. Evaluates conditions and resolves placeholders
4. Renders the proposal using existing PDF helpers (drawHeader, drawFooter, drawField, drawTable)
5. Handles page breaks for long spec paragraphs (existing multi-line text wrapping logic)
6. Outputs as download or preview (matching existing pattern)

Styling matches existing Tischler brand: navy headers (#1e3a5f), red accents (#da291c), professional typography.

## API Routes

New routes in `apps/api/src/routes/`:

### quote-templates.ts
- `GET /quote-templates` — List all templates
- `GET /quote-templates/:id` — Get template with presets and conditions
- `POST /quote-templates` — Create template
- `PATCH /quote-templates/:id` — Update template
- `DELETE /quote-templates/:id` — Delete template

### spec-presets.ts
- `GET /spec-presets?templateId=X` — List presets for a template
- `POST /spec-presets` — Create preset with conditions
- `PATCH /spec-presets/:id` — Update preset and its conditions
- `DELETE /spec-presets/:id` — Delete preset and its conditions
- `PATCH /spec-presets/reorder` — Batch update preset order values

## File Locations

| Component | Path |
|-----------|------|
| Prisma models | `packages/db/prisma/schema.prisma` |
| Quote template API routes | `apps/api/src/routes/quote-templates.ts` |
| Spec preset API routes | `apps/api/src/routes/spec-presets.ts` |
| Admin page | `apps/web/app/settings/quote-builder/page.tsx` |
| Settings sidebar | `apps/web/components/settings/settings-sidebar.tsx` |
| Conditions engine | `apps/web/lib/quote-conditions.ts` |
| PDF generation | `apps/web/app/summary/page.tsx` (extend existing) |
| Placeholder resolver | `apps/web/lib/quote-placeholders.ts` |

## Seed Data

V1 ships with a pre-populated "Standard Proposal" template containing all ~22 spec presets from the reference PDF (Little Club Rd proposal), with their conditions configured per Julian's annotations:

- Spec 1: Impact glass — condition: jobType = "Dade County Impact" AND glassType = "#28"
- Spec 2: Sipo mahogany — always included
- Spec 3: Unit types — generated from product types in summary
- Spec 6: SDL muntins — condition: summary has muntin fields
- Spec 7: Sill horns — condition: hasWindows = true
- Spec 8: Dip impregnation — always included
- Spec 9: Finish coat — condition: finishType is not empty
- Spec 10: Tempered glass doors — condition: hasDoors = true
- Spec 11: Glazing caulk — always included
- Spec 12: Security hardware — condition: hasGardenDoor AND KFV RH, or Corrosion Resistance RH
- Spec 13: 90-degree stops — condition: hasOutswing = true
- Spec 14: Handles — multiple sub-conditions per product type
- Spec 15: Hinges — condition: hasOutswing = true
- Spec 16: Neoprene gasket / weatherstrip — always included (sub-sections conditional)
- Spec 17: Bronze thresholds — condition: hasDoors = true
- Spec 18: Warranty — always included
- Spec 19: Shipment — always included
- Spec 20: Installation materials — always included
- Spec 21: Shop drawings — always included
- Spec 22: Down payment — always included
- Exclusions block — always included
- Magnetic Contacts option — condition: hasMagneticContacts = true
- Final Finish option — condition: hasFinalFinish = true
- Installation option — condition: hasInstallation = true
- Installation terms page — condition: hasInstallation = true

## V1 Scope

**In:**
- Prisma models + migration
- CRUD API routes for templates, presets, conditions
- Admin page at `/quote-builder`
- Condition evaluation engine
- Placeholder token resolution
- Proposal PDF generation from the Opportunity header highlights action
- Seed data for Standard Proposal
- Pages 1-5 of the proposal

**Out (future):**
- Inline text editing of assembled quotes before export
- Elevation pages (6-8)
- Quote versioning / history
- Multiple quote templates
- Email integration
- Saved/archived generated PDFs

## Verification

1. **Admin page:** Create, edit, reorder, and delete spec presets. Verify conditions save and load correctly.
2. **Condition engine:** Unit test with mock context objects. Verify AND/OR logic, placeholder resolution.
3. **PDF generation:** Generate a proposal PDF from an Opportunity linked to a summary that has Double Hungs + Euro Windows + Doors + installation. Compare output against the reference PDF structure.
4. **Edge cases:** Summary with only windows (no doors) — door-specific specs should be excluded. Summary with no add-ons — options section should be empty.
5. **Multi-user:** Two different reps generate quotes from different summaries — verify data isolation.
