import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db';
import { env } from '../config/env';
import { logger } from '../config/logger';

const backupDir = path.join(path.dirname(env.databasePath), 'backups');

export function runBackup(): string {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `app-${stamp}.sqlite`);
  db.prepare(`VACUUM INTO ?`).run(target);
  pruneOld();
  logger.info({ target }, 'backup_created');
  return target;
}

function pruneOld(): void {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(env.backup.keep)) {
    fs.rmSync(path.join(backupDir, old.f), { force: true });
  }
}

export function scheduleBackups(): void {
  if (!env.backup.enabled) return;
  try {
    runBackup();
  } catch (e) {
    logger.error({ e }, 'backup_failed');
  }
  setInterval(() => {
    try {
      runBackup();
    } catch (e) {
      logger.error({ e }, 'backup_failed');
    }
  }, 24 * 60 * 60 * 1000).unref();
}
