import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";
import { createVariant, type SaveVariantDTO } from "../services/variantService";

import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

export function useCreateVariant(productId: string) {
  return useCrudMutation({
    mutationFn: (payload: SaveVariantDTO) => createVariant(productId, payload),

    invalidateKeys: [
      productQueryKeys.products,
      productQueryKeys.product(productId),
      productQueryKeys.variants(productId),
    ],

    successMessage: productMessages.variant.created,

    errorMessage: "Erro ao criar variante.",
  });
}
