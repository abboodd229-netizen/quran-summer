import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Router } from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import { db, tx } from '../../db';
import { DEFAULT_LOTTERY_WINNERS, SETTING_KEYS, settingsSchema } from '@quran/shared';
import { asyncHandler, validateBody } from '../../middlewares/http';
import { requireAdmin, requireAuth } from '../../middlewares/auth';
import { writeAudit } from '../../core/audit';
import { Errors } from '../../utils/errors';
import { env } from '../../config/env';

const uploadBackup = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const getStmt = db.prepare(`SELECT value FROM app_settings WHERE key = ?`);
const setStmt = db.prepare(
  `INSERT INTO app_settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
);

export function getSetting(key: string): string | null {
  const r = getStmt.get(key) as { value: string } | undefined;
  return r ? r.value : null;
}

export function getLotteryDefaultWinners(): number {
  const v = getSetting(SETTING_KEYS.lotteryDefaultWinners);
  const n = v ? Number(v) : DEFAULT_LOTTERY_WINNERS;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOTTERY_WINNERS;
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare(`SELECT key, value FROM app_settings`).all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  if (!(SETTING_KEYS.lotteryDefaultWinners in out)) {
    out[SETTING_KEYS.lotteryDefaultWinners] = String(DEFAULT_LOTTERY_WINNERS);
  }
  return out;
}

export const settingsRouter = Router();

settingsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ settings: getAllSettings() });
  }),
);

settingsRouter.patch(
  '/',
  requireAdmin,
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as { lottery_default_winners?: number };
    tx(() => {
      if (body.lottery_default_winners != null) {
        setStmt.run(SETTING_KEYS.lotteryDefaultWinners, String(body.lottery_default_winners));
      }
      writeAudit({ userId: req.user!.id, action: 'update', entity: 'settings', after: body });
    });
    res.json({ settings: getAllSettings() });
  }),
);

/** تنزيل نسخة احتياطية كاملة من قاعدة البيانات */
settingsRouter.get(
  '/backup',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tmpPath = path.join(os.tmpdir(), `quran-backup-${stamp}.sqlite`);
    db.prepare('VACUUM INTO ?').run(tmpPath);
    res.download(tmpPath, `quran-backup-${stamp}.sqlite`, () => {
      fs.unlink(tmpPath, () => {});
    });
  }),
);

/** استعادة نسخة احتياطية — تحقق ثم حفظ كـ restore-pending.sqlite (يطبَّق عند إعادة التشغيل) */
settingsRouter.post(
  '/backup/restore',
  requireAdmin,
  uploadBackup.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw Errors.badRequest('لم يُرفع ملف');

    // Validate the uploaded file is a valid SQLite with expected tables
    const tmpPath = path.join(os.tmpdir(), `quran-validate-${Date.now()}.sqlite`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    let valid = false;
    try {
      const testDb = new Database(tmpPath, { readonly: true });
      const hasStudents = testDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='students'").get();
      const hasUsers = testDb.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
      testDb.close();
      valid = !!(hasStudents && hasUsers);
    } catch { /* not a valid sqlite file */ }
    fs.unlink(tmpPath, () => {});

    if (!valid) throw Errors.badRequest('الملف ليس نسخة احتياطية صالحة لهذا النظام');

    const pendingPath = path.join(path.dirname(env.databasePath), 'restore-pending.sqlite');
    fs.writeFileSync(pendingPath, req.file.buffer);

    writeAudit({
      userId: req.user!.id, action: 'restore_pending', entity: 'backup',
      after: { filename: req.file.originalname, bytes: req.file.size },
    });
    res.json({ ok: true, message: 'تم حفظ ملف الاستعادة. أعد تشغيل الخادم لتطبيق النسخة الاحتياطية.' });
  }),
);
