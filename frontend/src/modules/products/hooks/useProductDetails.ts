import { useProduct } from "./useProduct";
import { useProductVariants } from "./useProductVariants";

export function useProductDetails(productId: string) {
  const productQuery = useProduct(productId);

  const variantsQuery = useProductVariants(productId);

  return {
    product: productQuery.data,

    variants: variantsQuery.data,

    isLoading: productQuery.isLoading || variantsQuery.isLoading,

    isError: productQuery.isError || variantsQuery.isError,
  };
}
