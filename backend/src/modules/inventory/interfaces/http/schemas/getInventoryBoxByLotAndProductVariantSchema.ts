import { z } from "zod";

export const getInventoryBoxByLotAndProductVariantSchema = z.object({
  productVariantId: z.string().uuid({ message: "ID da variante inválido." }),
  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório."),
});
