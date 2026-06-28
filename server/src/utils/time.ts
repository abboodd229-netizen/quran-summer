import { randomBytes } from 'node:crypto';

export const nowIso = (): string => new Date().toISOString();

export const addDaysIso = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

export const token = (bytes = 32): string => randomBytes(bytes).toString('hex');
