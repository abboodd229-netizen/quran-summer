export const nowIso = (): string => new Date().toISOString();
export const addSecondsIso = (s: number): string => new Date(Date.now() + s * 1000).toISOString();
