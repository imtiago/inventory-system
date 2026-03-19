import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProduct } from "../services/productService";
import { toast } from "sonner";

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: any) => updateProduct(id, data),

    onSuccess: () => {
      toast.success("Produto atualizado");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },

    onError: () => {
      toast.error("Erro ao atualizar produto");
    },
  });
};
