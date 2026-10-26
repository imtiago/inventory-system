import { z } from "zod";

import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export const getInventoryBoxByLotAndProductVariantSchema = paginationSchema.extend({
  productVariantId: z.string().uuid({ message: "ID da variante inválido." }),
  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório."),
});
