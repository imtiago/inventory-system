import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { productQueryKeys } from "../config/queryKeys";
import { getProducts } from "../services/productService";
import type { ProductListParams } from "../types";

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: [...productQueryKeys.products, "list", params],

    queryFn: () => getProducts(params),

    placeholderData: keepPreviousData,
  });
}
