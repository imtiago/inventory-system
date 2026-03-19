import { getProducts } from "@/modules/products/services/productService";
import { useQuery } from "@tanstack/react-query";

export const useProducts = (search: string) => {
  return useQuery({
    queryKey: ["products", search],
    queryFn: () => getProducts(search),
  });
};
