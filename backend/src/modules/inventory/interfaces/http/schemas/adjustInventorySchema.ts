import { z } from "zod";

export const adjustInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  countedQuantity: z
    .number()
    .int("A quantidade contada deve ser um número inteiro.")
    .nonnegative("A quantidade contada não pode ser negativa."),

  notes: z.string().max(500, "As observações devem ter no máximo 500 caracteres.").optional(),
});

export type AdjustInventoryRequest = z.infer<typeof adjustInventorySchema>;
