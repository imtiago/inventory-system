/** Limita tentativas de login por chave (IP + e-mail normalizado). */
export interface ILoginAttemptLimiter {
  /**
   * Verifica e consome uma tentativa num único passo síncrono (sem await entre
   * checar e contar), para que requisições concorrentes não furem o limite.
   * Retorna false quando o limite da janela já foi atingido.
   */
  tryConsume(key: string, maxAttempts?: number): boolean;
  /** Zera o contador da chave (login com sucesso). */
  clear(key: string): void;
  /** Devolve uma tentativa consumida (nunca abaixo de zero), sem zerar a chave. */
  release(key: string): void;
}

/** Limites por camada (janela de 15 min, ver LoginAttemptLimiter). */
export const LOGIN_MAX_PER_PAIR = 10;
export const LOGIN_MAX_PER_ACCOUNT = 30;
export const LOGIN_MAX_PER_IP = 50;

export function loginAccountKey(normalizedEmail: string): string {
  return `account:${normalizedEmail}`;
}

export function loginIpKey(ip: string): string {
  return `ip:${ip}`;
}

export function loginAttemptKey(ip: string, normalizedEmail: string): string {
  return `${ip}|${normalizedEmail}`;
}
