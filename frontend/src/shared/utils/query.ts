// src/shared/utils/query.ts

import { QueryClient, type QueryKey } from "@tanstack/react-query";

export async function invalidateQueries(
  queryClient: QueryClient,
  queries: QueryKey[],
) {
  await Promise.all(
    queries.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
