// shared/react-query/useCrudMutation.ts

import {
  type QueryKey,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { invalidate } from "./invalidate";

import { notify } from "../utils/notify";
import { handleMutationError } from "../utils/mutation";
import { useIdempotencyKey } from "../utils/idempotencyKey";

interface CrudMutationOptions<TData, TVariables> {
  /** With `idempotent`, receives the Idempotency-Key of this attempt as second argument. */
  mutationFn: (variables: TVariables, idempotencyKey: string) => Promise<TData>;

  /** Sends one Idempotency-Key per user action, kept across retries with the same variables. */
  idempotent?: boolean;

  invalidateKeys?: readonly QueryKey[];

  /** Runs after the mutation succeeds and before invalidation (e.g. to drop queries of a deleted entity). */
  onSettledCache?: (queryClient: QueryClient, variables: TVariables) => void;

  successMessage?: string;

  errorMessage?: string;

  /** When true, no default error toast is shown (the caller displays the error itself). */
  silentError?: boolean;
}

export function useCrudMutation<TData, TVariables>({
  mutationFn,
  idempotent = false,
  invalidateKeys = [],
  onSettledCache,
  successMessage,
  errorMessage = "Ocorreu um erro.",
  silentError = false,
}: CrudMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const keys = useIdempotencyKey();

  return useMutation({
    mutationFn: (variables: TVariables) =>
      idempotent ? keys.run(variables, (key) => mutationFn(variables, key)) : mutationFn(variables, ""),

    async onSuccess(_data, variables) {
      onSettledCache?.(queryClient, variables);

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
