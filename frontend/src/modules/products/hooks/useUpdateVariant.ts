import { updateVariant, type SaveVariantDTO } from "../services/variantService";
import { queryKeys } from "@/shared/react-query/keys";
import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";

export function useUpdateVariant(variantId: string, productId: string) {
  return useCrudMutation({
    mutationFn: (payload: Partial<SaveVariantDTO>) => updateVariant(variantId, payload),

    invalidateKeys: [
      queryKeys.inventory,
      productQueryKeys.variant(variantId),
      productQueryKeys.products,
      productQueryKeys.product(productId),
      productQueryKeys.variants(productId),
    ],

    successMessage: productMessages.variant.updated,

    errorMessage: "Erro ao atualizar variante.",
  });
}
