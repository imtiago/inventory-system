// shared/react-query/invalidate.ts

import { QueryClient, type QueryKey } from "@tanstack/react-query";

export async function invalidate(
  queryClient: QueryClient,
  ...queries: readonly QueryKey[]
) {
  await Promise.all(
    queries.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  );
}
