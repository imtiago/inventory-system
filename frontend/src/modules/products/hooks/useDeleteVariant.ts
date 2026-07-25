import { deleteVariant } from "../services/variantService";

import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";

export function useDeleteVariant(productId: string) {
  return useCrudMutation({
    mutationFn: deleteVariant,

    invalidateKeys: [
      productQueryKeys.products,
      productQueryKeys.product(productId),
      productQueryKeys.variants(productId),
    ],

    successMessage: productMessages.variant.deleted,

    errorMessage: "Erro ao excluir variante.",
  });
}
