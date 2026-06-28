import { Router } from 'express';
import { db } from '../../db';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { requireAuth } from '../../middlewares/auth';
import { lockSchema } from '@quran/shared';
import { addSecondsIso, nowIso } from '../../utils/lockTime';

export const locksRouter = Router();
const LOCK_TTL = 30; // ثوانٍ

const sel = db.prepare(`SELECT resource_type, resource_id, user_id AS userId, expires_at AS expiresAt FROM resource_locks WHERE resource_type = ? AND resource_id = ?`);
const del = db.prepare(`DELETE FROM resource_locks WHERE resource_type = ? AND resource_id = ?`);
const upsert = db.prepare(
  `INSERT INTO resource_locks (resource_type, resource_id, user_id, acquired_at, expires_at)
   VALUES (@t, @r, @u, @a, @e)
   ON CONFLICT(resource_type, resource_id) DO UPDATE SET user_id=@u, acquired_at=@a, expires_at=@e`,
);

function holder(t: string, r: string) {
  const row = sel.get(t, r) as { resource_type: string; resource_id: string; userId: number; expiresAt: string } | undefined;
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) { del.run(t, r); return null; }
  return row;
}

/** محاولة حجز قفل أو تجديده */
locksRouter.post(
  '/',
  requireAuth,
  validateBody(lockSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId } = req.body as { resourceType: string; resourceId: string };
    const cur = holder(resourceType, resourceId);
    if (cur && cur.userId !== req.user!.id) {
      const name = (db.prepare(`SELECT name FROM users WHERE id = ?`).get(cur.userId) as { name: string } | undefined)?.name;
      res.json({ locked: true, mine: false, by: name ?? 'مستخدم آخر' });
      return;
    }
    upsert.run({ t: resourceType, r: resourceId, u: req.user!.id, a: nowIso(), e: addSecondsIso(LOCK_TTL) });
    res.json({ locked: true, mine: true });
  }),
);

/** تجديد القفل (heartbeat) */
locksRouter.post(
  '/heartbeat',
  requireAuth,
  validateBody(lockSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId } = req.body as { resourceType: string; resourceId: string };
    const cur = holder(resourceType, resourceId);
    if (!cur || cur.userId === req.user!.id) {
      upsert.run({ t: resourceType, r: resourceId, u: req.user!.id, a: nowIso(), e: addSecondsIso(LOCK_TTL) });
      res.json({ ok: true, mine: true });
      return;
    }
    res.json({ ok: true, mine: false });
  }),
);

/** تحرير القفل */
locksRouter.delete(
  '/',
  requireAuth,
  validateBody(lockSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId } = req.body as { resourceType: string; resourceId: string };
    const cur = holder(resourceType, resourceId);
    if (cur && cur.userId === req.user!.id) del.run(resourceType, resourceId);
    res.json({ ok: true });
  }),
);
