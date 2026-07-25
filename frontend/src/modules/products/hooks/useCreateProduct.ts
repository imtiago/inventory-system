import { createProduct } from "../services/productService";

import { queryKeys } from "@/shared/react-query/keys";
import { useCrudMutation } from "@/shared/react-query/useCrudMutation";

export function useCreateProduct() {
  return useCrudMutation({
    mutationFn: createProduct,

    invalidateKeys: [queryKeys.products],

    successMessage: "Produto cadastrado com sucesso.",

    errorMessage: "Erro ao cadastrar produto.",
  });
}
