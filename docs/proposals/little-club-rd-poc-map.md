# Little Club Rd Proposal POC Map

This document maps the marked-up Little Club Rd proposal into the proof-of-concept rules for Proposal Builder. The goal is wording fidelity: proposal text should remain contract-like and admin-maintained, with only the project-specific values and inclusion rules made dynamic.

## Reference

- Source PDF: `c:/Users/jjjip/Downloads/Little Club Rd 1 26489 Quote 1(Julian Edits).pdf`
- POC body scope: pages 1-5, covering the proposal letter, options, exclusions, closing, and installation appendix.
- Deferred body scope: elevation pages and final production logo/document packet handling.

## Section Map

| Section | Source | Dynamic Inputs | Inclusion Rule |
|---|---|---|---|
| Letterhead | Static asset | Logo/contact assets when available | Always |
| Date | System | Today's date | Always |
| Addressee | Opportunity and related records | Individual receiving quote, account receiving quote, address | Always |
| Opening | Template block | Opportunity name, project number | Always |
| Base bid notice | Template block | Plans dated | Always |
| Numbered specifications | Proposal blocks | Job type, glass, spacer bars, wood, SDL/TDL, product types, hardware options | Block conditions |
| Pricing | Summary totals | Double Hung, Euro Windows, Doors, grand total from Final W/ADJ | Show non-zero rows |
| Options | Proposal blocks plus add-on pricing | Magnetic contacts, final finish, installation and related add-on final values | Add-on conditions |
| Exclusions | Proposal blocks | Mostly static clause text | Always for POC |
| Closing | Proposal blocks | Sales signature text when available | Always |
| Installation appendix | Proposal blocks plus add-on pricing | Installation final values and terms | Only when installation add-on is included |

## Initial Variable Map

| Token | Meaning | Source |
|---|---|---|
| `{{todayDate}}` | Proposal date | System date |
| `{{contactName}}` | Individual receiving proposal | Opportunity/contact lookup or summary fallback |
| `{{contactSalutation}}` | Contact salutation | Contact lookup |
| `{{contactLastName}}` | Contact last name | Contact lookup or parsed summary name |
| `{{companyName}}` | Account receiving proposal | Summary/account data |
| `{{companyAddress}}` | Account address block | Summary/account data |
| `{{projectName}}` | Opportunity/project name | Summary or Opportunity |
| `{{projectNumber}}` | Project/opportunity number | Summary |
| `{{plansDated}}` | Plans/schedules date | Summary |
| `{{jobType}}` | Job type clause driver | Summary |
| `{{glassType}}` | Glass clause wording | Summary |
| `{{spacerBarColor}}` | Spacer bar colors | Summary |
| `{{woodType}}` | Wood species | Summary |
| `{{sdlType}}` | SDL/TDL/muntin wording | Summary |
| `{{doubleHungPrice}}` | Double Hung total | Summary quote totals Final W/ADJ |
| `{{euroWindowsPrice}}` | Euro Windows total | Summary quote totals Final W/ADJ |
| `{{euroDoorsPrice}}` | Doors total | Summary quote totals Final W/ADJ |
| `{{grandTotal}}` | Base bid price | Summary totals plus adjustment |
| `{{magneticContactPrice}}` | Magnetic contact add-on | Summary add-on final |
| `{{finalFinishPrice}}` | Final finish add-on | Summary add-on final |
| `{{installationPrice}}` | Installation add-on total | Summary add-on final |

## Initial Condition Map

| Clause / Block | Condition |
|---|---|
| Impact glass specification | Job type/glass indicates Dade County impact or comparable impact glass |
| Product type list | Product types included in windows and doors rows |
| SDL / muntin paragraph | SDL, TDL, or muntin value present |
| Exterior window sills | Job has windows |
| Finish coat clause | Finish field present, with special wording when finish type is 200 |
| Door safety glass | Job has doors |
| Security rough hardware | Garden door with KFV RH and corrosion resistance options, or Lift & Roll with SS RH condition |
| 90-degree stops | Outswing windows or doors present |
| Handles clause | Product types drive sub-sentences for windows, garden doors, Lift & Roll, and double hungs |
| Hinges clause | Outswing doors/windows selected, no final selected |
| Weatherstrip clause | Standard windows/doors plus separate double-hung sentence when double hungs exist |
| Bronze thresholds | Doors present |
| Warranty | Jobs with glass |
| Shipment | All jobs |
| Installation materials | All jobs in POC body |
| Shop drawings | All jobs |
| Down payment | All jobs |
| Magnetic alarm contacts option | Magnetic contact add-on final value is non-zero |
| Final finish option | Final finish add-on final value is non-zero |
| Installation option and appendix | Installation add-on final value is non-zero |
| Exclusions and standard close | All POC proposals |

## Admin Builder Requirements

- Admins need to edit full clause text, not shortened summaries.
- Admins need to see both raw tokens and resolved values in preview.
- Admins need inclusion explanations, especially for add-ons and product-type clauses.
- Missing tokens should show as warnings before a proposal is generated.
- One default proposal template should be enough for the POC; product and add-on differences should be represented as conditional blocks.

## Deferred Items

- Persisted generated proposal records.
- Dropbox save/upload.
- Email sending and approval workflows.
- Final logo/document packet handling.
- Full elevation-page attachment/rendering when the source data and document pipeline are ready.
