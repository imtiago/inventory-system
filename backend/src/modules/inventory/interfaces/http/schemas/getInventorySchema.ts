// backend/src/modules/inventory/interfaces/http/schemas/getInventorySchema.ts
import { z } from "zod";

export const getInventorySchema = z.object({
  variantId: z.string().uuid({ message: "ID da variante inválido." }),
});

export const getInventoryByIdParamsSchema = z.object({
  id: z.string().uuid("ID do estoque inválido."),
});
