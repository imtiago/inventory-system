import { QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

import { notify } from "./notify";
import { invalidateQueries } from "./query";
import { handleMutationError } from "./mutation";

interface Options {
  queryClient: QueryClient;
  invalidate?: QueryKey[];
  successMessage?: string;
}

export function createMutationOptions({
  queryClient,
  invalidate = [],
  successMessage,
}: Options) {
  return {
    onSuccess: async () => {
      if (invalidate.length > 0) {
        await invalidateQueries(queryClient, invalidate);
      }

      if (successMessage) {
        notify.success(successMessage);
      }
    },

    onError: handleMutationError,
  };
}
