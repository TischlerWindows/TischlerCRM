# TischlerCRM — Agent Guide

Internal CRM for Tischler. Tracks customers, jobs, installations, support tickets, and integrations on top of a Salesforce-style custom-object metadata layer with a visual page builder and an automation engine (triggers, controllers, widgets). Dropbox-backed file storage. Deployed on Railway.

This file is the source of truth for Claude Code sessions working in this repo. Read it before exploring.

## Tech stack

- **Web** ([apps/web](apps/web)): Next.js 14 (App Router) + React 18 + TypeScript + Tailwind 3.4 + Radix UI + Zustand. Tests: Jest.
- **API** ([apps/api](apps/api)): Fastify 5 + TypeScript (ESM) + Zod. Build via esbuild; AWS Lambda target available.
- **DB** ([packages/db](packages/db)): Prisma 5.17 + PostgreSQL. Schema at [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma).
- **Tooling**: pnpm 9 workspaces, ESLint, Prettier (single quotes, semis, 100-col, trailing-comma `es5`, LF).
- **Deploy**: Railway. CI workflows under [.github/workflows/](.github/workflows).

## Repo layout

```
apps/
  web/       Next.js frontend (pages, components, widgets, hooks, lib/)
  api/       Fastify backend (routes/, triggers/, controllers/, widgets/, workflow-engine.ts)
packages/
  db/        Prisma schema, migrations, generated client (exports @crm/db)
  types/     Shared TS interfaces (@crm/types)
  storage/   File-storage abstraction with Dropbox impl (@crm/storage)
  widgets/   Shared widget type definitions (@crm/widgets)
  triggers/  Shared trigger interfaces (@crm/triggers)
  controllers/ Shared controller interfaces (@crm/controllers)
docs/
  superpowers/specs/   Dated design specs (YYYY-MM-DD-*.md) — read the most recent for a feature before changing it
  widget-developer-guide.md
```

## Commands

Run from repo root unless noted. **Always pnpm, never npm/yarn.**

```bash
pnpm install                    # install (uses pnpm-lock.yaml)
pnpm dev                        # all dev servers in parallel
pnpm --filter web dev           # web only
pnpm --filter api dev           # api only
pnpm build                      # build all
pnpm typecheck                  # tsc --noEmit across workspaces
pnpm lint                       # eslint across workspaces
pnpm test                       # jest (currently web only)
pnpm format                     # prettier --write

# DB ops (from apps/api)
pnpm --filter api run db:generate    # prisma generate
pnpm --filter api run db:migrate     # prisma migrate dev
pnpm --filter api run db:setup       # generate + migrate + seed
pnpm --filter api run seed           # run seed.ts

# Schema-only (from packages/db)
pnpm --filter @crm/db run prisma:push          # push schema (dev)
pnpm --filter @crm/db run prisma:push:deploy   # push schema with --accept-data-loss (prod boot)
```

Run a single Jest test: `pnpm --filter web exec jest path/to/file.test.ts`.

## Environment

Copy [.env.example](.env.example) → `.env` at repo root. Required: `DATABASE_URL`, `JWT_SECRET`. Optional: `ENCRYPTION_KEY` (encrypts integration tokens at rest; falls back to `JWT_SECRET` in dev).

**Integration API keys** (Outlook, Dropbox, Google Maps, etc.) are **not** env vars — they live in the DB, configured through **Settings > Integrations** in the UI, encrypted at rest with `ENCRYPTION_KEY`.

## Backend conventions

Non-negotiable rules for code under [apps/api/src/](apps/api/src):

- **JWT payload is `{ sub, role, exp }`.** Use `(req as any).user?.sub` for user identity. **Never** `.id`.
- **Validate every request body with Zod.** No `request.body as any` without a schema.
- **Clamp query params**: `limit` ∈ [1, 200], `offset` ≥ 0.
- **Authorization**: admin-only endpoints live under `/admin/*` or include an explicit role check. Login events, backups, and audit logs are admin-only.
- **Error shape**: `reply.code(N).send({ error: string })`. Never `reply.status()`. Don't `throw new Error()` for validation — return 400 with `{ error }`.
- **No hardcoded fallback identities** (e.g. `'default-user-id'`). Missing user context → 401.
- **Route ordering**: register static paths (`/records/search`) **before** parameterized paths (`/records/:id`). Fastify matches in registration order.
- **Prisma**: the only valid models are those in [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma). Don't invent `prisma.account` or other non-existent models.

## Frontend conventions

Non-negotiable rules for code under [apps/web/](apps/web):

- Every data-fetching page has `[error, setError]` state and renders an error banner on failure. **No silent empty lists.**
- Show a loading indicator while fetching.
- Validate required fields before submit. Validate email format and password strength on auth forms.
- **On API failure: surface the error, do not redirect.**
- No `console.log` in production code.
- Avoid `any` — type API responses, form data, and component props.
- Every `href` / `router.push()` must match an existing route. Watch for multi-segment paths on single-segment routes.
- **No dead-end buttons.** Every button has a functional `onClick`/`href`, or it's hidden / shows a "Coming soon" tooltip.
- Modals: `aria-modal`, `aria-labelledby`, and focus trap. Toasts: `role="alert"` or `role="status"`.
- Responsive: avoid fixed pixel widths without fallbacks.

## Architecture concepts

### Custom objects + records

Salesforce-style metadata layer. The schema in [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) is the source of truth.

- `CustomObject` — object metadata (api name, label, etc.).
- `CustomField` — field definitions (Text, Number, Picklist, Lookup, MasterDetail, …).
- `Record` — actual rows; payload stored as `data: Json`.
- `Relationship` — Lookup / MasterDetail relations between objects.

### Page builder

Hierarchical layout per object. Frontend at [apps/web/app/object-manager/\[objectApi\]/page-editor/](apps/web/app/object-manager). Backend at [apps/api/src/routes/layouts.ts](apps/api/src/routes/layouts.ts).

```
PageLayout
  └── LayoutTab
       └── LayoutRegion (12-col grid)
            ├── LayoutPanel
            │    └── PanelField (field + label style + behavior)
            └── LayoutWidget (inline custom component)
```

Formatting rules and forward-compatible config live in `PageLayout.extensions` (JSON).

### Triggers, Controllers, Widgets — opt-out model

**All three fire/render by default.** Disable them via per-org rows: `TriggerSetting`, `ControllerSetting`, `WidgetSetting`. The "Automations" / "Widgets" Settings UI is **for disabling**, not enabling.

- **Triggers**: registered in [apps/api/src/triggers/](apps/api/src). Fire on record create/edit. Evaluated by [apps/api/src/workflow-engine.ts](apps/api/src/workflow-engine.ts) — condition evaluator + action executor (field updates, email alerts, task creation).
- **Controllers**: registered in [apps/api/src/controllers/](apps/api/src). Server-side hooks that intercept record operations to run custom logic / side effects.
- **Widgets**: registered in [apps/api/src/widgets/](apps/api/src) (backend metadata) and [apps/web/widgets/](apps/web/widgets) (render). Inline components in record detail pages.

Settings UI: [apps/web/app/settings/automations/](apps/web/app/settings/automations).

### Slots

Composite widget types that link parent records to related Contact/Account records with configurable summary display + click-through navigation. Example: [apps/web/widgets/internal/team-member-slot/](apps/web/widgets/internal/team-member-slot). Config schemas in [apps/web/lib/schema.ts](apps/web/lib/schema.ts).

## Path aliases

**Web** ([apps/web/tsconfig.json](apps/web/tsconfig.json)):
- `@/*` → `apps/web/*`
- `@types/*` → `packages/types/src/*`
- `@db` → `packages/db/src`
- `@storage` → `packages/storage/src`

**Workspace packages** (any app):
- `@crm/db`, `@crm/types`, `@crm/storage`, `@crm/widgets`, `@crm/triggers`, `@crm/controllers`

## Testing

- Jest in `apps/web` only (no backend tests yet).
- Co-located: `**/__tests__/**/*.test.ts`.
- Config: [apps/web/jest.config.cjs](apps/web/jest.config.cjs) (ts-jest preset).
- `apps/web/tsconfig.json` excludes `__tests__/` from the main TS build — tests live outside the production type-check.

## Working in this repo as an agent

- **One PR per unit of work.** After a PR is pushed, follow-up changes go on a **new** branch — never pile onto a handed-off PR.
- **Worktree gotcha**: when working inside `.claude/worktrees/<name>`, absolute paths can still resolve to the main repo. After the first edit, run `git status` to confirm changes landed in the worktree, not main.
- **Specs first**: before changing a feature area (page builder, slots, triggers, widgets, installations, service module, etc.), read the most recent dated spec in [docs/superpowers/specs/](docs/superpowers/specs) for that area.
- **Schema first**: when touching data, read [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) first. Don't guess model names.
- **Don't add backwards-compat shims**, dead `// removed` comments, or unused re-exports when removing code. Just delete it.
