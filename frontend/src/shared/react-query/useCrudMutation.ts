// shared/react-query/useCrudMutation.ts

import {
  type MutationFunction,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { invalidate } from "./invalidate";

import { notify } from "../utils/notify";
import { handleMutationError } from "../utils/mutation";

interface CrudMutationOptions<TData, TVariables> {
  mutationFn: MutationFunction<TData, TVariables>;

  invalidateKeys?: readonly QueryKey[];

  successMessage?: string;

  errorMessage?: string;

  /** When true, no default error toast is shown (the caller displays the error itself). */
  silentError?: boolean;
}

export function useCrudMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys = [],
  successMessage,
  errorMessage = "Ocorreu um erro.",
  silentError = false,
}: CrudMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    async onSuccess() {
      if (invalidateKeys.length) {
        await invalidate(queryClient, ...invalidateKeys);
      }

      if (successMessage) {
        notify.success(successMessage);
      }
    },

    onError(error) {
      if (silentError) return;

      handleMutationError(error, errorMessage);
    },
  });
}
