// shared/utils/mutation.ts

import { parseApiErrorSync } from "../services/parseApiError";
import { notify } from "./notify";

export function handleMutationError(error: unknown, defaultMessage: string) {
  const { status, code, message } = parseApiErrorSync(error);

  // The axios interceptor already redirects to /login on 401.
  if (status === 401) return;

  notify.error(code === "UNKNOWN_ERROR" ? defaultMessage : message);
}
