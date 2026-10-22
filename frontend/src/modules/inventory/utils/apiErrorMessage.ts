/** Extracts the `{ message }` sent by the API from an axios error, or returns the fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;

  return typeof message === 'string' && message.trim() ? message : fallback;
}
