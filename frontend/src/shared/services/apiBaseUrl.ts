/**
 * Base URL of the backend.
 *
 * - `VITE_API_URL` always wins (staging, production, or a dev who wants to hit another backend).
 * - In `vite dev` without it we use `/api`, which the dev server proxies to the backend: same origin as the page, so a phone
 *   on the Wi-Fi (https://<pc-ip>:5173) never needs to reach `localhost:3000` and there is no mixed content or CORS.
 * - Otherwise (built bundle without VITE_API_URL) the previous default is kept.
 */
export function resolveApiBaseUrl(env: { VITE_API_URL?: string; DEV?: boolean }): string {
  if (env.VITE_API_URL) return env.VITE_API_URL;

  return env.DEV ? '/api' : 'http://localhost:3000';
}
