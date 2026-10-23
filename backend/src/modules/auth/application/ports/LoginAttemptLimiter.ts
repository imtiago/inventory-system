/** Limita tentativas de login por chave (IP + e-mail normalizado). */
export interface ILoginAttemptLimiter {
  /**
   * Verifica e consome uma tentativa num único passo síncrono (sem await entre
   * checar e contar), para que requisições concorrentes não furem o limite.
   * Retorna false quando o limite da janela já foi atingido.
   */
  tryConsume(key: string): boolean;
  /** Zera o contador da chave (login com sucesso). */
  clear(key: string): void;
}

export function loginAttemptKey(ip: string, normalizedEmail: string): string {
  return `${ip}|${normalizedEmail}`;
}
