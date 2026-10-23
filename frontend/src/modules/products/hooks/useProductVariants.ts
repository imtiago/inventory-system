import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { productQueryKeys } from "../config/queryKeys";
import { getProductVariants } from "../services/productService";

export const VARIANTS_PAGE_SIZE = 10;

export function useProductVariants(productId: string, page = 1, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...productQueryKeys.variants(productId), page],

    queryFn: () => getProductVariants(productId, { page, limit: VARIANTS_PAGE_SIZE }),

    enabled: !!productId && enabled,

    placeholderData: keepPreviousData,
  });
}
