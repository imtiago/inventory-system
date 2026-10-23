import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

const MAX_RETRIES = 3;

/** Retries network errors and 5xx only; 4xx responses are deterministic and never retried. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status !== undefined && status >= 400 && status < 500) return false;
  }

  return failureCount < MAX_RETRIES;
}

/** App-wide singleton, reachable from non-React code (e.g. the 401 interceptor). */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryQuery } },
});
