# Changelog

All notable changes are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-06-29

First production release for the 1448 H summer Quran circles programme —
الجمعية الخيرية لتحفيظ القرآن الكريم بجازان.

### Added

**Core platform**
- Weekly evaluation grid (Sun–Thu) for attendance, appearance, behaviour; weekly curriculum key.
- Automatic eligibility engine: lottery-eligible = no violation; excellence-eligible = lottery-eligible + no curriculum violation.
- Cryptographically random lottery draw per group (5 groups), draft → final flow, undo for admin.
- Excellence winner selection per circle per week (auto if one candidate, manual otherwise).
- Role system: admin (unrestricted) + assistants (scoped to assigned circles + explicit permissions).
- Session-based auth (SQLite-backed, httpOnly cookie, bcrypt).
- Audit log — every mutating action recorded inside the same transaction.
- Soft resource locks (TTL) to prevent concurrent evaluation edits.
- Daily automatic SQLite backup (`VACUUM INTO`) with configurable retention (default: keep 14).
- Student import from Excel (`xlsx`) and export; 204 pre-seeded students across 14 circles.
- Weekly summary report + PDF print template (Arabic RTL).
- Server-Sent Events (`GET /api/stream`) for real-time lottery and status updates.

**Lottery presentation screen** (`/present/lottery`)
- Full-screen projector display with group-selection cards (status badges, eligible counts).
- Manual winner reveal — operator presses button for each winner, no auto-timer.
- Rolling-drum animation on live SSE draw.
- Auto-scaling winner name font (`FitName`) — always single line regardless of name length.
- Passes current `weekId` via URL param so pre-drawn results load immediately on open.

**Branding & UI**
- Organisation logo (`logo.png`) + summer programme logo (`logo-summer.png`) + SVG favicon.
- Green/gold design system (`brand-*`, `gold-*`, `cream`, `ink` Tailwind tokens).
- RTL-first layout (Tajawal Arabic font, `dir="rtl"`).
- Circle auto-naming from track selection: no manual name entry; name generated as `{prefix} (N)`.
- Official Arabic circle naming convention applied to all 14 seeded circles.

### Fixed

- **Critical production crash**: `import './types/express.d'` in `server/src/index.ts` caused a
  `MODULE_NOT_FOUND` error at runtime because TypeScript declaration files are not emitted as `.js`.
  Removed the import (declaration files are picked up automatically by the type-checker).
- Lottery presentation screen showed blank on open after a draw was already finalised — it only
  listened to SSE events and missed draws that happened before the window opened.
- Winner name overflow on long names — replaced fixed `vw` size with `useLayoutEffect` measurement.
- Circle track-sort detection in `catalog.ts` updated for new naming patterns
  (`كاملًا`/`كاملاً`, `وعشرين`).

### Security

- Helmet.js with default secure headers (HSTS, X-Frame-Options, etc.).
- `SESSION_SECRET` required in production; hard dev-only fallback logged as a warning.
- All SQL via parameterised `better-sqlite3` statements — no string interpolation.
- Passwords hashed with bcrypt (cost 12).
- `requirePermission` middleware enforces assistant scope on every protected route.
- Admin credential change enforced on first login (documented in deployment guide).
