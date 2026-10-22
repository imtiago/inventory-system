import { z } from "zod";

export const createInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
