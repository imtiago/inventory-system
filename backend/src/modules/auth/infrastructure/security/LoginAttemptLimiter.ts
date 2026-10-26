import { ILoginAttemptLimiter } from "@auth/application/ports/LoginAttemptLimiter";

export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMITER_MAX_ENTRIES = 10_000;
const PRUNE_EVERY_N_CALLS = 1000;

type Entry = { attempts: number; windowStart: number };

/**
 * Limitador em memória (por processo): janela fixa de 15 min contada a partir
 * da primeira tentativa; no máximo 10 tentativas sem sucesso por janela.
 * Memória limitada a `maxEntries` chaves (descarta as mais antigas primeiro).
 */
export class LoginAttemptLimiter implements ILoginAttemptLimiter {
  private readonly entries = new Map<string, Entry>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private callsSincePrune = 0;

  constructor(
    opts: {
      maxAttempts?: number;
      windowMs?: number;
      maxEntries?: number;
      now?: () => number;
    } = {},
  ) {
    this.maxAttempts = opts.maxAttempts ?? LOGIN_MAX_ATTEMPTS;
    this.windowMs = opts.windowMs ?? LOGIN_WINDOW_MS;
    this.maxEntries = opts.maxEntries ?? LOGIN_LIMITER_MAX_ENTRIES;
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  tryConsume(key: string, maxAttempts: number = this.maxAttempts): boolean {
    const now = this.now();
    this.maybePrune(now);

    const entry = this.entries.get(key);
    if (entry && now - entry.windowStart <= this.windowMs) {
      if (entry.attempts >= maxAttempts) return false;
      entry.attempts += 1;
      return true;
    }

    // Nova janela: reinsere no fim (ordem de inserção = mais antiga primeiro).
    this.entries.delete(key);
    this.entries.set(key, { attempts: 1, windowStart: now });
    this.evictOverflow();
    return true;
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.attempts > 0) entry.attempts -= 1;
  }

  /** Zera todos os contadores (uso em testes). */
  reset(): void {
    this.entries.clear();
    this.callsSincePrune = 0;
  }

  // Varredura de expirados no máximo a cada N chamadas.
  private maybePrune(now: number): void {
    if (++this.callsSincePrune < PRUNE_EVERY_N_CALLS) return;
    this.callsSincePrune = 0;
    for (const [key, entry] of this.entries) {
      if (now - entry.windowStart > this.windowMs) this.entries.delete(key);
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

/** Instância única usada pela rota de login. */
export const loginAttemptLimiter = new LoginAttemptLimiter();

/** Instância separada para a senha atual em PUT /users/me/password (chave `pwd:<userId>`). */
export const passwordChangeAttemptLimiter = new LoginAttemptLimiter();
