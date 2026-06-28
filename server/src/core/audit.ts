import { db } from '../db';
import { nowIso } from '../utils/time';

const stmt = db.prepare(
  `INSERT INTO audit_logs (user_id, action, entity, entity_id, before, after, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
);

export interface AuditInput {
  userId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

/** يكتب حدث تدقيق — يُستدعى ضمن المعاملة نفسها للتغيير */
export function writeAudit(a: AuditInput): void {
  stmt.run(
    a.userId,
    a.action,
    a.entity,
    a.entityId == null ? null : String(a.entityId),
    a.before === undefined ? null : JSON.stringify(a.before),
    a.after === undefined ? null : JSON.stringify(a.after),
    nowIso(),
  );
}
