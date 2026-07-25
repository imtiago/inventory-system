// shared/utils/mutation.ts

import axios from "axios";

import { notify } from "./notify";

export function handleMutationError(error: unknown, defaultMessage: string) {
  console.error(error);

  if (axios.isAxiosError(error)) {
    notify.error(error.response?.data?.message ?? defaultMessage);

    return;
  }

  notify.error(defaultMessage);
}
