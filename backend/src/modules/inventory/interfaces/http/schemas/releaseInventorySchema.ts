import { z } from "zod";

export const releaseInventorySchema = z.object({
  inventoryId: z.string().uuid("ID do estoque inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),

  notes: z.string().trim().optional(),
});

export type ReleaseInventoryInput = z.infer<typeof releaseInventorySchema>;
