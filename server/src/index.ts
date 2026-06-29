import './startup-restore'; // must be first — applies pending restore before db opens
import { createApp } from './app';
import { applySchema, db, tx } from './db';
import { env } from './config/env';
import { logger } from './config/logger';
import { hashPassword } from './modules/auth/auth.service';
import { scheduleBackups } from './core/backup';
import { ensureCatalog } from './db/seed/catalog';
import { nowIso } from './utils/time';

function ensureAdmin(): void {
  const exists = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (exists) return;
  db.prepare(`INSERT INTO users (name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)`)
    .run(env.admin.name, env.admin.username, hashPassword(env.admin.password), nowIso());
  logger.warn(`تم إنشاء حساب المدير الأولي: ${env.admin.username} — غيّر كلمة المرور بعد الدخول`);
}

function main(): void {
  applySchema();
  tx(() => ensureCatalog());
  ensureAdmin();
  scheduleBackups();
  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`الخادم يعمل على المنفذ ${env.port} (${env.nodeEnv})`);
  });
}

main();
