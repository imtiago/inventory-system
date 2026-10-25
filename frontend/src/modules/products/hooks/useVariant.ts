import { useQuery } from "@tanstack/react-query";

import { productQueryKeys } from "../config/queryKeys";
import { getVariant } from "../services/variantService";

export function useVariant(id: string) {
  return useQuery({
    queryKey: productQueryKeys.variant(id),
    queryFn: () => getVariant(id),
    enabled: !!id,

    // The edit form must never start from a stale copy (it would resend the old price).
    refetchOnMount: "always",
  });
}
