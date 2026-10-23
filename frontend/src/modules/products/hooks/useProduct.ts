import { useQuery } from "@tanstack/react-query";

import { getProductById } from "../services/productService";

export function useProduct(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["products", id],

    queryFn: () => getProductById(id),

    enabled: !!id && enabled,
  });
}
