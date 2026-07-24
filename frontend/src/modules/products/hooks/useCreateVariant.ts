import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createVariant,
  type CreateVariantDTO,
} from "../services/productService";

export function useCreateVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVariantDTO) => createVariant(productId, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product", productId, "variants"],
      });
    },
  });
}
