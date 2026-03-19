import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProduct } from "../services/productService";
import { toast } from "sonner";

interface UpdateInput {
  id: string;
  input: {
    name: string;
    sku: string;
    brandId?: string;
    categoryId?: string;
  };
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: UpdateInput) => {
      // Garante que sempre envia objeto no body
      if (!input || Object.keys(input).length === 0) {
        throw new Error("Dados do produto inválidos");
      }
      return await updateProduct(id, input);
    },

    onSuccess: () => {
      toast.success("Produto atualizado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },

    onError: () => {
      toast.error("Erro ao atualizar produto");
    },
  });
};
