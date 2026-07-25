import { updateVariant, type SaveVariantDTO } from "../services/variantService";
import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";

export function useUpdateVariant(variantId: string, productId: string) {
  return useCrudMutation({
    mutationFn: (payload: SaveVariantDTO) => updateVariant(variantId, payload),

    invalidateKeys: [
      productQueryKeys.products,
      productQueryKeys.product(productId),
      productQueryKeys.variants(productId),
    ],

    successMessage: productMessages.variant.updated,

    errorMessage: "Erro ao atualizar variante.",
  });
}
