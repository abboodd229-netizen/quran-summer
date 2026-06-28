import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';

/** يلتقط أخطاء async ويمرّرها للوسيط المركزي */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** يتحقّق من جسم الطلب عبر Zod ويستبدله بالقيمة المُحوّلة */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(new AppError(400, 'validation', 'بيانات غير صحيحة', flattenZod(parsed.error)));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

function flattenZod(e: ZodError) {
  return e.errors.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** الوسيط المركزي للأخطاء */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  const anyErr = err as { status?: number; code?: string; message?: string };
  if (anyErr && typeof anyErr.status === 'number') {
    res.status(anyErr.status).json({
      error: { code: anyErr.code ?? 'error', message: anyErr.message ?? 'حدث خطأ' },
    });
    return;
  }
  logger.error({ err }, 'unhandled_error');
  res.status(500).json({ error: { code: 'internal', message: 'حدث خطأ غير متوقّع' } });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'المسار غير موجود' } });
}
