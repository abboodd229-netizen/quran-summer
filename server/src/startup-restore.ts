import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env';

/**
 * Checks for a pending restore file (restore-pending.sqlite) placed by the
 * backup restore endpoint and applies it BEFORE the database module opens.
 * This module must be imported first in index.ts.
 */
const pendingPath = path.join(path.dirname(env.databasePath), 'restore-pending.sqlite');

if (fs.existsSync(pendingPath)) {
  try {
    // Remove WAL and SHM files to prevent corruption after file swap
    for (const ext of ['-wal', '-shm']) {
      const walFile = env.databasePath + ext;
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    }
    fs.copyFileSync(pendingPath, env.databasePath);
    fs.unlinkSync(pendingPath);
    process.stdout.write('[startup] تم تطبيق النسخة الاحتياطية المحفوظة بنجاح.\n');
  } catch (err) {
    process.stderr.write(`[startup] فشل تطبيق نسخة الاستعادة: ${err}\n`);
  }
}
