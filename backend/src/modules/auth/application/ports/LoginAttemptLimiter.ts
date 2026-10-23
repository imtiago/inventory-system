/** Limita falhas de login por chave (IP + e-mail normalizado). */
export interface ILoginAttemptLimiter {
  isBlocked(key: string): boolean;
  registerFailure(key: string): void;
  clear(key: string): void;
}

export function loginAttemptKey(ip: string, normalizedEmail: string): string {
  return `${ip}|${normalizedEmail}`;
}
