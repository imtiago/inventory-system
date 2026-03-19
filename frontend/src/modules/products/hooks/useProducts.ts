import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../services/productService";

export const useProducts = (search: string = "") => {
  return useQuery({
    queryKey: ["products", search],
    queryFn: () => getProducts(search),
  });
};
