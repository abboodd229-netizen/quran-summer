# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # installs all workspaces and auto-builds shared (postinstall hook)
npm run build        # builds shared → client → server (must all pass)
npm run dev          # builds shared then runs server (8080) + client (5173) concurrently
npm run seed         # seeds the DB: groups/circles/weeks + 204 students + admin user
npm start            # runs dist/index.js (production server, serves client dist/)
```

Build order matters: `shared` must compile before `client` or `server` can reference `@quran/shared`.

Default admin credentials: `admin` / `Admin@12345` (change after first login).

## Architecture

This is an npm workspaces monorepo with three packages:

- **`shared/`** — compiled to `shared/dist/`, imported as `@quran/shared` by both server and client. Contains all domain constants (`constants.ts`), Zod validation schemas (`schemas.ts`), and TypeScript types (`types.ts`). This is the single source of truth for criteria, permissions, roles, and event statuses.

- **`server/`** — Express + TypeScript + better-sqlite3 (WAL mode). Compiled by `tsc`, entry point `src/index.ts`. All API routes live under `/api`. In production, serves `client/dist/` as static files from the same port (8080).

- **`client/`** — React 18 + Vite + Tailwind + React Query + React Router. Entry `src/main.tsx`. All API calls go through `src/lib/api.ts` (thin fetch wrapper that prefixes `/api`). Dev proxy is configured in `vite.config.ts`.

### Server structure

```
server/src/
├─ config/        env.ts (all env vars), logger.ts (pino)
├─ db/            index.ts (singleton db + tx() helper), schema.ts (SCHEMA_SQL constant),
│                 schema.sql (source), seed/ (seed.ts + data.json with 204 real students)
├─ core/          eligibility.ts, lottery.ts, status.ts, audit.ts, sse.ts, backup.ts
├─ middlewares/   auth.ts (requireAuth, requirePermission, assertCircleScope),
│                 http.ts (asyncHandler, validateBody, errorHandler)
└─ modules/       one directory per domain, each exports a Router
```

`db/index.ts` exports `db` (the singleton Database instance) and `tx(fn)` (runs fn inside a SQLite transaction). All writes use `tx()`.

`core/status.ts` exports `recomputeStudentWeek(studentId, weekId)` — called by the events module after every upsert to keep `student_week_status` current.

`core/sse.ts` exports `broadcast(event, data)` — sends real-time updates to all connected clients via Server-Sent Events at `GET /api/stream`.

### Client structure

```
client/src/
├─ app/           AuthContext.tsx (session user + can()), AppState.tsx (weeks + weekId + save status),
│                 AppShell.tsx (sidebar nav + header), router.tsx, nav.ts
├─ components/    ui.tsx — shared component library (Button, Card, Modal, StatCard, TextField, …)
└─ features/      one directory per page/route
```

**`AppState`** (React context) holds the globally selected week (`weekId`) and the list of all weeks. Every page that needs the current week reads `useAppState()`.

**`AuthContext`** holds `user: SessionUser | null` and the `can(...perms)` helper (admin always passes; assistants check their permissions array).

### Domain model

- **Groups** → **Circles** → **Students** (hierarchical for lottery purposes)
- **Weeks** are pre-seeded (4 weeks). Each week is independent.
- **StudentEvents** store one row per `(student, week, criterion, day_date)` with a unique index — allows upsert via `INSERT OR REPLACE` semantics.
- **student_week_status** is a denormalised cache recomputed on every event write. Never write to it directly.
- **Lotteries** go `draft → final` (one-way in normal flow). Each group gets one lottery per week.
- **ExcellenceWinners** — one per `(week, circle)`.
- **Sessions** are stored in SQLite (not JWT), read via `loadSessionUser()` in `auth.service.ts`.
- **AuditLogs** — every mutating action calls `writeAudit()` inside the same transaction.
- **ResourceLocks** — soft edit locks with TTL, used on the evaluation page to prevent concurrent edits.

### Eligibility engine (`core/eligibility.ts`)

Pure function `computeEligibility(events[])`:
- Lottery-eligible = no violation in attendance / appearance / behavior
- Excellence-eligible = lottery-eligible AND no curriculum violation

**Do not modify this function.** It is the authoritative business rule.

### Permissions

`admin` bypasses all permission checks (`requirePermission` and `assertCircleScope`). Assistants have a `circleIds[]` scope and an explicit `permissions[]` list. Both are embedded in the session row and re-read on every request.

### Tailwind design tokens

Defined in `client/tailwind.config.ts`:
- `brand-{50…900}` — green palette (primary)
- `gold-{100…700}` — award/highlight accent
- `cream` — page background (`#F8F7F2`)
- `ink` / `muted` — text hierarchy
- `line` — borders
- `danger` / `warn` — error / warning states

Component classes are defined in `client/src/index.css` (`@layer components`): `.card`, `.btn`, `.btn-{variant}`, `.btn-{size}`, `.input`, `.chip`, `.chip-{variant}`.

### Environment variables

All optional (sensible dev defaults in `config/env.ts`):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_PATH` | `./data/app.sqlite` | SQLite file path |
| `PORT` | `8080` | HTTP port |
| `SESSION_SECRET` | `dev-insecure-…` | Cookie signing — **must change in prod** |
| `SESSION_TTL_DAYS` | `7` | Session lifetime |
| `ADMIN_USERNAME/PASSWORD/NAME` | `admin` / `Admin@12345` / `مدير النظام` | Seed-time admin |
| `BACKUP_ENABLED` | `true` | Daily SQLite backup |
| `BACKUP_KEEP` | `14` | Backup retention count |

### TypeScript path aliases

`client` uses `@/` → `client/src/` (configured in `vite.config.ts` and `tsconfig.json`). The server has no path aliases.

### Adding a new API module

1. Create `server/src/modules/<name>/<name>.routes.ts` exporting a Router.
2. Import and mount it in `server/src/app.ts` under `api.use(...)`.
3. For new permissions, add to `PERMISSIONS` in `shared/src/constants.ts` and `PERMISSION_LABELS`.

### Adding a new client page

1. Create `client/src/features/<name>/<Name>Page.tsx`.
2. Import and add a route in `client/src/app/router.tsx`.
3. Add a nav entry in `client/src/app/nav.ts` if needed.
