import { db, applySchema, tx } from '../index';
import { env } from '../../config/env';
import { hashPassword } from '../../modules/auth/auth.service';
import { nowIso } from '../../utils/time';
import { ensureCatalog, seedStudents } from './catalog';

function seed(): void {
  applySchema();
  let students = 0;
  tx(() => {
    ensureCatalog();
    students = seedStudents();
    const admin = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (!admin) {
      db.prepare(
        `INSERT INTO users (name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)`,
      ).run(env.admin.name, env.admin.username, hashPassword(env.admin.password), nowIso());
    }
  });
  const counts = {
    groups: (db.prepare(`SELECT COUNT(*) n FROM lottery_groups`).get() as { n: number }).n,
    circles: (db.prepare(`SELECT COUNT(*) n FROM circles`).get() as { n: number }).n,
    weeks: (db.prepare(`SELECT COUNT(*) n FROM weeks`).get() as { n: number }).n,
    students: (db.prepare(`SELECT COUNT(*) n FROM students`).get() as { n: number }).n,
    studentsAddedNow: students,
  };
  // eslint-disable-next-line no-console
  console.log('تمت التهيئة:', counts);
}

seed();
