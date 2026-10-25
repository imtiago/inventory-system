import { deleteVariant } from "../services/variantService";

import { queryKeys } from "@/shared/react-query/keys";
import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";

export function useDeleteVariant(productId: string) {
  return useCrudMutation({
    mutationFn: deleteVariant,

    // The deleted variant must not be served from cache nor refetched (it would 404).
    onSettledCache: (queryClient, variantId) => {
      queryClient.removeQueries({ queryKey: productQueryKeys.variant(variantId) });
    },

    invalidateKeys: [
      queryKeys.inventory,
      productQueryKeys.products,
      productQueryKeys.product(productId),
      productQueryKeys.variants(productId),
    ],

    successMessage: productMessages.variant.deleted,

    errorMessage: "Erro ao excluir variante.",
  });
}
