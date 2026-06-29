import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { SCHEMA_SQL } from './schema';

const dir = path.dirname(env.databasePath);
fs.mkdirSync(dir, { recursive: true });

export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/** يطبّق المخطّط (CREATE TABLE IF NOT EXISTS) — آمن للتكرار */
export function applySchema(): void {
  db.exec(SCHEMA_SQL);
  // ترقية قواعد البيانات القديمة — يفشل بصمت إن كان العمود موجودًا بالفعل
  try { db.exec(`ALTER TABLE weeks ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE circles ADD COLUMN track_id INTEGER REFERENCES tracks(id)`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE circles ADD COLUMN teacher_name TEXT`); } catch { /* already exists */ }
}

// يُطبّق المخطّط فور تحميل الوحدة، قبل تجهيز أي عبارات في المسارات
applySchema();

/** غلاف معاملة ذرّية */
export function tx<T>(fn: () => T): T {
  const run = db.transaction(fn);
  return run();
}
