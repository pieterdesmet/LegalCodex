# AI-native Legal Practice Management MVP

Minimal but complete MVP built with **Next.js App Router + TypeScript + Tailwind + Prisma + PostgreSQL**.

## Features

- Auth with credentials + role-based access control (ADMIN, LAWYER, STAFF)
- Dashboard overview (open dossiers, 7-day deadlines, recent docs, AI briefing)
- Clients CRUD
- Dossiers CRUD linked to clients
- Tasks + deadline tracking
- Time tracking (start/stop + list)
- Document templates + generation with placeholders
- AI-native dossier assistant panel:
  - Generate dossier summary suggestion
  - Suggest next tasks
  - Review latest document
  - Deadline risk scan
- API routes for all entities
- Governance:
  - AI output is suggestion-only (never auto-send / auto-publish / legal decision)
  - Confidence + provenance in AI JSON output
  - Every AI call logs `AIEvent`
  - Every create/update/delete logs `AuditLog`

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Zod validation

## Project Structure

```txt
app/
  (auth)/login/page.tsx
  (app)/layout.tsx
  (app)/dashboard/page.tsx
  (app)/clients/page.tsx
  (app)/clients/[id]/page.tsx
  (app)/dossiers/page.tsx
  (app)/dossiers/[id]/page.tsx
  (app)/tasks/page.tsx
  (app)/documents/page.tsx
  (app)/time-tracking/page.tsx
  api/
    ai/agent/route.ts
    clients/route.ts
    clients/[id]/route.ts
    dossiers/route.ts
    dossiers/[id]/route.ts
    tasks/route.ts
    tasks/[id]/route.ts
    time-entries/route.ts
    time-entries/[id]/route.ts
    documents/route.ts
    documents/[id]/route.ts
    templates/route.ts
    templates/[id]/route.ts
components/
  dossier-ai-panel.tsx
  sidebar.tsx
lib/
  ai/
    llm.ts
    context-builder.ts
    prompts.ts
    service.ts
    providers/mock.ts
    providers/openai.ts
  api.ts
  audit.ts
  auth.ts
  prisma.ts
  rbac.ts
  templates.ts
  validators.ts
prisma/
  schema.prisma
  seed.ts
  migrations/
    migration_lock.toml
    20260204120000_init/migration.sql
```

## Environment Variables

Create `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_mvp?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
OPENAI_API_KEY="" # optional
```

If your local Postgres user is different (for example `pieterdesmet`), adjust `DATABASE_URL` accordingly.

## Setup

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm test
pnpm dev
```

Open `http://localhost:3000`.

## Demo Credentials

- `admin@demo.law` / `demo1234`
- `lawyer@demo.law` / `demo1234`
- `staff@demo.law` / `demo1234`

## AI Layer Notes

- `lib/ai/llm.ts` exposes provider-agnostic `LLMClient` interface.
- `lib/ai/providers/mock.ts` gives deterministic JSON when no API key is set.
- `lib/ai/providers/openai.ts` is a drop-in adapter for OpenAI.
- AI output schema is validated with Zod and retried once if invalid JSON.

## Safety & Governance Notes

- AI is **read-only by default**.
- Applying AI summary/tasks requires explicit user click.
- AI responses include confidence and `sourceRefs` provenance.
- Every AI request writes `AIEvent`.
- All write operations create `AuditLog` entries.
- RBAC is enforced server-side in page actions and API routes.

## RBAC Rules

- `ADMIN`: all
- `LAWYER`: all practice data
- `STAFF`:
  - can read all practice data
  - can create/update tasks, documents, and time entries
  - cannot delete clients/dossiers

## Notes

- Deleting clients/dossiers is implemented as safe soft-delete (`deletedAt`).
- API routes are protected by session + role checks.
- Middleware redirects unauthenticated page requests to `/login`.
