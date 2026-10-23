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
 * The same key is kept across every failed retry while the variables are unchanged: the server
 * never stores error responses, so reusing the key is always safe, and a 409 (a previous request
 * with this key is still running) must not lead to a new key that could run the operation twice.
 * It is renewed after success, when the data change, and on 422 IDEMPOTENCY_KEY_REUSED.
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

  /** Keeps the key for the next retry of the same data, except when the server rejected the key itself. */
  failed(error: unknown): void {
    if (parseApiErrorSync(error).code === 'IDEMPOTENCY_KEY_REUSED') this.reset();
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
