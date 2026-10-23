import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";
import { deleteProduct } from "../services/productService";

// Backend errors (e.g. 409 PRODUCT_IN_USE) are shown once, as a toast with the backend message.
export function useDeleteProduct() {
  return useCrudMutation({
    mutationFn: (id: string) => deleteProduct(id),

    // The deleted product's detail/variants queries must not be refetched (they would 404).
    onSettledCache(queryClient, id) {
      queryClient.removeQueries({ queryKey: productQueryKeys.product(id) }); // includes its variants
    },

    invalidateKeys: [productQueryKeys.products],

    successMessage: productMessages.product.deleted,

    errorMessage: "Erro ao excluir produto.",
  });
}
