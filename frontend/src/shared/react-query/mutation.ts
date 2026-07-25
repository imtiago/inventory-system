// src/shared/react-query/mutation.ts

import { QueryClient, type QueryKey } from "@tanstack/react-query";

import { invalidate } from "./invalidate";

import { notify } from "../utils/notify";
import { handleMutationError } from "../utils/mutation";

interface MutationCallbacksOptions {
  queryClient: QueryClient;

  invalidateKeys?: readonly QueryKey[];

  successMessage?: string;

  errorMessage?: string;
}

export function mutationCallbacks({
  queryClient,
  invalidateKeys = [],
  successMessage,
  errorMessage = "Não foi possível concluir a operação.",
}: MutationCallbacksOptions) {
  return {
    async onSuccess() {
      if (invalidateKeys.length > 0) {
        await invalidate(queryClient, ...invalidateKeys);
      }

      if (successMessage) {
        notify.success(successMessage);
      }
    },

    onError(error: unknown) {
      handleMutationError(error, errorMessage);
    },
  };
}
