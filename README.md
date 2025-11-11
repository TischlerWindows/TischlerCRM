# CRM Monorepo

## Executive Summary
We are building a web-hosted CRM focusing on Accounts, Contacts, Opportunities, Activities, and Files. Dropbox will serve as the initial embedded storage layer (linked folders with in-app preview) to accelerate time-to-value.

### Phased Delivery
- **Phase 0 – Foundations (Week 1):** Project setup, auth baseline, minimal schema, environments, CI/CD.
- **Phase 1 – Dropbox File Layer (Weeks 2–3):** Auto-create folders, store links, in-app file list + preview.
- **Phase 2 – Core CRM (Weeks 3–5):** CRUD UI, pipeline views, search, reporting, alerts.
- **Phase 3 – Hardening (Weeks 6–8):** RBAC, audit, rate limits, SSO, backups, monitoring, cost controls.

## Tech Stack
- Frontend: Next.js (App Router) + React + Tailwind + shadcn/ui
- Backend: Node.js (serverless-ready) – initial local REST handlers abstracted for AWS Lambda / Azure Functions
- Database: PostgreSQL (Prisma ORM)
- File Storage: Dropbox (folder per record, link + preview)
- Infra: Terraform (future), GitHub Actions CI

## Workspaces
This repository uses a pnpm monorepo layout:
- `apps/web` – Next.js frontend
- `apps/api` – Backend handlers (lambda-ready)
- `packages/types` – Shared TypeScript interfaces
- `packages/db` – Prisma schema + client
- `packages/storage` – Abstract storage service + Dropbox stub

## Getting Started
1. Install core dependencies:
```bash
pnpm install
```
2. Create environment file:
```bash
cp .env.example .env
```
3. Run dev servers:
```bash
pnpm --filter web dev
pnpm --filter api dev
```

## Initial Entities (MVP)
- Account
- Contact
- Opportunity
- Activity
- FileLink (Dropbox folder + file metadata)

## Scripts (planned)
- `pnpm build` – build all packages
- `pnpm lint` – lint all workspaces
- `pnpm test` – run tests (unit + integration)

## Acceptance Criteria (MVP)
- User authentication and access control for core records
- Opportunity creation provisions Dropbox folder and saves canonical URL
- File panel lists + previews Dropbox files
- CRUD for core objects + search and pipeline report
- Backups and error tracking validated

## License
Internal proprietary.
