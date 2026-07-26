import { useQuery } from "@tanstack/react-query";

import { getVariantInventory } from "../services/inventoryService";

export function useVariantInventory(variantId: string) {
  return useQuery({
    queryKey: ["inventory", "variants", variantId],

    queryFn: () => getVariantInventory(variantId),

    enabled: !!variantId,
  });
}
