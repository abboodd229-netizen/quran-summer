export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (m = 'يجب تسجيل الدخول') => new AppError(401, 'unauthorized', m),
  forbidden: (m = 'لا تملك صلاحية لهذا الإجراء') => new AppError(403, 'forbidden', m),
  notFound: (m = 'العنصر غير موجود') => new AppError(404, 'not_found', m),
  conflict: (m = 'تعارض في التحرير') => new AppError(409, 'conflict', m),
  badRequest: (m = 'طلب غير صالح', d?: unknown) => new AppError(400, 'bad_request', m, d),
  validation: (d: unknown) => new AppError(400, 'validation', 'بيانات غير صحيحة', d),
};
