import { ILoginAttemptLimiter } from "@auth/application/ports/LoginAttemptLimiter";

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type Entry = { failures: number; windowStart: number };

/**
 * Limitador em memória (por processo): janela fixa de 15 min contada a partir
 * da primeira falha; bloqueia ao atingir 10 falhas na janela.
 */
export class LoginAttemptLimiter implements ILoginAttemptLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(
    opts: { maxFailures?: number; windowMs?: number; now?: () => number } = {},
  ) {
    this.maxFailures = opts.maxFailures ?? LOGIN_MAX_FAILURES;
    this.windowMs = opts.windowMs ?? LOGIN_WINDOW_MS;
    this.now = opts.now ?? Date.now;
  }

  private current(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && this.now() - entry.windowStart > this.windowMs) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  isBlocked(key: string): boolean {
    const entry = this.current(key);
    return entry !== undefined && entry.failures >= this.maxFailures;
  }

  registerFailure(key: string): void {
    this.pruneExpired();
    const entry = this.current(key);
    if (entry) {
      entry.failures += 1;
    } else {
      this.entries.set(key, { failures: 1, windowStart: this.now() });
    }
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  /** Zera todos os contadores (uso em testes). */
  reset(): void {
    this.entries.clear();
  }

  // Evita crescimento ilimitado do mapa com chaves expiradas.
  private pruneExpired(): void {
    if (this.entries.size < 1000) return;
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.windowMs) this.entries.delete(key);
    }
  }
}

/** Instância única usada pela rota de login. */
export const loginAttemptLimiter = new LoginAttemptLimiter();
