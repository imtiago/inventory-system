import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProduct } from "../services/productService";
import { toast } from "sonner";
import { handleMutationError } from "@/shared/utils/mutation";

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,

    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },

    onError: (error) => {
      handleMutationError(error, "Erro ao excluir produto");
    },
  });
};
