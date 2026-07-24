import { useQuery } from "@tanstack/react-query";

import { getProductVariants } from "../services/productService";

export function useProductVariants(productId: string) {
  return useQuery({
    queryKey: ["products", productId, "variants"],

    queryFn: () => getProductVariants(productId),

    enabled: !!productId,
  });
}
