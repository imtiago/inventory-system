import { parseApiErrorSync } from '@/shared/services/parseApiError';

/** Message sent by the API for an error, or the fallback when the error is not a standard API error. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const parsed = parseApiErrorSync(error);

  return parsed.code === 'UNKNOWN_ERROR' ? fallback : parsed.message;
}

/** Outcome of a wizard mutation; the caller decides (after a staleness check) whether to show the error. */
export type MutationResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
