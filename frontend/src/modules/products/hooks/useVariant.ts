import { useQuery } from "@tanstack/react-query";

import { getVariant } from "../services/variantService";

export function useVariant(id: string) {
  return useQuery({
    queryKey: ["variant", id],
    queryFn: () => getVariant(id),
    enabled: !!id,
  });
}
