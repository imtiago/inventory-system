import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

import { productMessages } from "../config/messages";
import { productQueryKeys } from "../config/queryKeys";
import { updateProduct } from "../services/productService";
import type { UpdateProductInput } from "../types";

interface UpdateVariables {
  id: string;
  input: UpdateProductInput;
}

/** `silentError` lets a form render backend errors itself instead of a toast. */
export function useUpdateProduct({ silentError = false }: { silentError?: boolean } = {}) {
  return useCrudMutation({
    mutationFn: ({ id, input }: UpdateVariables) => updateProduct(id, input),

    // The "products" prefix covers the list, the detail and the variants queries.
    invalidateKeys: [productQueryKeys.products],

    successMessage: productMessages.product.updated,

    errorMessage: "Erro ao atualizar produto.",

    silentError,
  });
}
