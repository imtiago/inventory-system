import { useRef } from 'react';

import { parseApiErrorSync } from '../services/parseApiError';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Axios request config carrying the key. */
export function idempotencyConfig(idempotencyKey: string) {
  return { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } };
}

/**
 * Holds the key of the current attempt of one user action.
 * The same key is kept across retries (network error, timeout, 5xx) while the variables are
 * unchanged, so the server can replay the original result instead of running the operation twice.
 * It is renewed after success, when the data change, and after any answer the server decided
 * (4xx: nothing was stored, so the key was not consumed or must not be reused).
 */
export class IdempotencyKeyTracker {
  private key: string | null = null;

  private fingerprint: string | null = null;

  keyFor(variables: unknown): string {
    const fingerprint = JSON.stringify(variables ?? null);

    if (this.key === null || this.fingerprint !== fingerprint) {
      this.key = newIdempotencyKey();
      this.fingerprint = fingerprint;
    }

    return this.key;
  }

  reset(): void {
    this.key = null;
    this.fingerprint = null;
  }

  /** Keeps the key only when the outcome is unknown (no response or 5xx). */
  failed(error: unknown): void {
    const { status } = parseApiErrorSync(error);

    if (status !== null && status < 500) this.reset();
  }

  /** Runs `run` with the key of this attempt and updates the key lifecycle from the outcome. */
  async run<TVariables, TData>(variables: TVariables, run: (idempotencyKey: string) => Promise<TData>): Promise<TData> {
    try {
      const result = await run(this.keyFor(variables));

      this.reset();

      return result;
    } catch (error: unknown) {
      this.failed(error);

      throw error;
    }
  }
}

export function useIdempotencyKey(): IdempotencyKeyTracker {
  const ref = useRef<IdempotencyKeyTracker | null>(null);

  ref.current ??= new IdempotencyKeyTracker();

  return ref.current;
}
