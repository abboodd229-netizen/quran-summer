import { z } from 'zod';
import { CRITERIA, EVENT_STATUS, PERMISSIONS, ROLES, WEEK_DAYS } from './constants';

export const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب').max(64),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').max(128),
});

export const createUserSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(120),
  username: z.string().min(3, 'اسم المستخدم 3 أحرف على الأقل').max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'أحرف لاتينية وأرقام فقط'),
  password: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل').max(128),
  role: z.enum(ROLES).default('assistant'),
  circleIds: z.array(z.number().int().positive()).default([]),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(6).max(128).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  circleIds: z.array(z.number().int().positive()).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
});

export const createStudentSchema = z.object({
  name: z.string().min(1, 'اسم الطالب مطلوب').max(120),
  circleId: z.number().int().positive(),
});

export const moveStudentSchema = z.object({
  circleId: z.number().int().positive(),
});

export const upsertEventSchema = z.object({
  studentId: z.number().int().positive(),
  weekId: z.number().int().positive(),
  criterion: z.enum(CRITERIA),
  status: z.enum(EVENT_STATUS),
  dayDate: z.enum(WEEK_DAYS).nullable().optional(),
  note: z.string().max(300).optional(),
});
export type UpsertEventInput = z.infer<typeof upsertEventSchema>;

export const lotteryDrawSchema = z.object({
  weekId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  winnersCount: z.number().int().min(1).max(50).optional(),
});

export const selectExcellenceSchema = z.object({
  weekId: z.number().int().positive(),
  circleId: z.number().int().positive(),
  studentId: z.number().int().positive(),
});

export const lockSchema = z.object({
  resourceType: z.string().min(1).max(40),
  resourceId: z.string().min(1).max(60),
});

export const settingsSchema = z.object({
  lottery_default_winners: z.coerce.number().int().min(1).max(50).optional(),
});
