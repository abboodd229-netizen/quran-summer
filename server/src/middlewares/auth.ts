import type { NextFunction, Request, Response } from 'express';
import { loadSessionUser } from '../modules/auth/auth.service';
import { Errors } from '../utils/errors';
import type { Permission } from '@quran/shared';

export const SESSION_COOKIE = 'qss_session';

/** يحمّل المستخدم إن وُجد (لا يرفض) */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const sid = req.cookies?.[SESSION_COOKIE];
  const loaded = loadSessionUser(sid);
  if (loaded) {
    req.user = loaded.user;
    req.sessionId = loaded.sessionId;
  }
  next();
}

/** يتطلّب جلسة صالحة */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw Errors.unauthorized();
  next();
}

/** يتطلّب صلاحية (المدير يتجاوز) */
export function requirePermission(...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const u = req.user;
    if (!u) throw Errors.unauthorized();
    if (u.role === 'admin') return next();
    const ok = perms.some((p) => u.permissions.includes(p));
    if (!ok) throw Errors.forbidden();
    next();
  };
}

/** يتطلّب دور المدير */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw Errors.unauthorized();
  if (req.user.role !== 'admin') throw Errors.forbidden();
  next();
}

/** يتحقّق أن الحلقة ضمن نطاق المساعد (المدير يتجاوز) */
export function assertCircleScope(req: Request, circleId: number): void {
  const u = req.user!;
  if (u.role === 'admin') return;
  if (!u.circleIds.includes(circleId)) throw Errors.forbidden('هذه الحلقة خارج نطاقك');
}
