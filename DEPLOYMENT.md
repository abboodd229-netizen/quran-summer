# Deployment Guide — منصة الحلقات الصيفية

Production deployment checklist and reference.
Platforms covered: **Render** (primary) · Railway · any Linux VPS.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS or newer |
| npm | 10+ |
| OS | Linux (recommended) / macOS / Windows (WSL for native modules) |

`better-sqlite3` compiles a native addon via `node-gyp`. On Linux this works
out of the box. On Windows install "Desktop development with C++" via Visual Studio
Installer, or use WSL.

---

## Quick deployment (any server / VPS)

```bash
# 1. Clone / copy the project
git clone <repo-url> && cd quran-summer

# 2. Install and build
npm install          # also builds shared/ via postinstall
npm run build        # shared → client → server

# 3. Configure environment
cp .env.example .env
#   Edit .env — at minimum set SESSION_SECRET and DATABASE_PATH

# 4. Seed the database (first run only)
npm run seed

# 5. Start
npm start            # serves on port 8080 (or PORT env var)
```

---

## Environment variables

All variables are **optional** — sensible dev defaults are built in.
In production, always set at least `NODE_ENV`, `SESSION_SECRET`, `DATABASE_PATH`.

| Variable | Default | Required in prod | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | Yes | Set to `production` |
| `PORT` | `8080` | No | HTTP listen port |
| `SESSION_SECRET` | *(insecure dev value)* | **Yes** | Long random string for cookie signing |
| `SESSION_TTL_DAYS` | `7` | No | Session lifetime in days |
| `DATABASE_PATH` | `./data/app.sqlite` | Yes | Absolute path preferred on servers |
| `ADMIN_USERNAME` | `admin` | No | Seed-time admin username |
| `ADMIN_PASSWORD` | `Admin@12345` | **Yes** | Change before go-live |
| `ADMIN_NAME` | `مدير النظام` | No | Admin display name |
| `BACKUP_ENABLED` | `true` | No | Enable daily automatic backup |
| `BACKUP_KEEP` | `14` | No | Number of backup files to retain |

Generate a strong `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Render deployment

### Prerequisites
- A Render account with a **Starter plan** (or above) — the Free tier does not
  support Persistent Disks, which are mandatory for SQLite persistence.
- Your repository pushed to GitHub / GitLab.

### Option A — Blueprint (render.yaml — recommended)

The repo ships with `render.yaml`. Render will read it automatically when you
create a new Blueprint deployment.

1. **Render Dashboard → New → Blueprint**
2. Connect your Git repository — Render detects `render.yaml` and creates the
   service + Persistent Disk automatically.
3. Before the first deploy, open the service **Environment** tab and add:
   ```
   ADMIN_PASSWORD=<strong-password>
   ```
   (Do not commit the real password — it is intentionally absent from `render.yaml`.)
4. Click **Deploy**.
5. After the first successful deploy, open the **Shell** tab and run:
   ```bash
   npm run seed
   ```
   This loads the 204 students, 14 circles, 5 groups, and 4 weeks.

### Option B — Manual service setup

1. **Render Dashboard → New → Web Service** → connect repository.
2. Set:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter or above
3. **Environment → Add Environment Variables**:
   ```
   NODE_ENV=production
   SESSION_SECRET=<long-random-string>
   DATABASE_PATH=/var/data/app.sqlite
   BACKUP_ENABLED=true
   BACKUP_KEEP=14
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<strong-password>
   ADMIN_NAME=مدير النظام
   ```
4. **Disks → Add Disk**:
   - Name: `quran-data`
   - Mount Path: `/var/data`
   - Size: 1 GB (minimum)
5. Deploy, then run `npm run seed` from the Shell tab.

### Critical notes

| Rule | Why |
|---|---|
| **Persistent Disk is mandatory** | Without it the SQLite file lives in the ephemeral filesystem and is lost on every redeploy. |
| **Instances = 1** | SQLite does not support concurrent writes from multiple processes. Never scale beyond one instance. |
| **Shell → `npm run seed`** | Must be run once after the first deploy. Safe to re-run — it uses `INSERT OR IGNORE`. |
| **Change admin password** | Log in with the credentials from `ADMIN_PASSWORD` and change via Profile immediately. |

### Health check

Render monitors `GET /api/health` (configured in `render.yaml`).
Response: `{ "ok": true, "ts": <unix-ms> }`.

### Backup and restore on Render

Backups are written daily to `/var/data/backups/` (same Persistent Disk).

To restore via Render Shell:
```bash
# List backups
ls /var/data/backups/

# Restore (server restarts automatically on next deploy)
cp /var/data/backups/app-2026-06-29T07-00-00-000Z.sqlite /var/data/restore-pending.sqlite
# Then trigger a manual redeploy — startup-restore.ts applies it before the DB opens
```

---

## Railway deployment

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for step-by-step Railway instructions including
Volume (persistent disk) setup, environment variables panel, and seed command.

Key Railway requirements:
- **Add a Volume** mounted at `/data` — without it all data is lost on redeploy.
- Set `DATABASE_PATH=/data/app.sqlite`.
- Keep **Replicas = 1** — SQLite does not support concurrent multi-process writes.
- Build command: `npm install && npm run build`
- Start command: `npm start`

---

## Database

- SQLite file at `DATABASE_PATH` (default `./data/app.sqlite`), WAL mode.
- Backups written to `<database-dir>/backups/app-<timestamp>.sqlite` daily at startup.
- Schema applied automatically on every start via `applySchema()`.
- Seed data (204 students, 14 circles, 5 groups, 4 weeks) via `npm run seed`.

### Restore from backup

```bash
# Stop the server, swap the file, restart
cp /data/backups/app-2026-06-29T07-00-00.sqlite /data/app.sqlite
```

---

## Production checklist

- [ ] `NODE_ENV=production` set
- [ ] `SESSION_SECRET` changed from default (long random string)
- [ ] `ADMIN_PASSWORD` changed from `Admin@12345`
- [ ] `DATABASE_PATH` points to persistent storage (not `/tmp`)
- [ ] `BACKUP_ENABLED=true` and Volume/disk mounted at backup path
- [ ] Single replica / single process (no horizontal scaling)
- [ ] `npm run seed` executed once after first deploy
- [ ] Admin password changed via Profile page after first login
- [ ] Assistant accounts created and scoped to their circles

---

## Build artefacts

After `npm run build`:

| Path | Contents |
|---|---|
| `shared/dist/` | Compiled shared types, schemas, constants |
| `client/dist/` | Production Vite bundle (HTML + CSS + JS + assets) |
| `server/dist/` | Compiled Express server |
| `server/dist/db/seed/data.json` | Copied seed data |

The server serves `client/dist/` as static files when `NODE_ENV=production`.
Dev proxy (port 5173 → 8080) is only active during `npm run dev`.

---

## Monitoring / logs

The server uses [pino](https://github.com/pinojs/pino) structured JSON logging.
Each request logs method, URL, status, and response time.
Backup events log as `backup_created` or `backup_failed`.
