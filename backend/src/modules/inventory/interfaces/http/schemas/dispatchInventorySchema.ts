// backend/src/modules/inventory/interfaces/http/schemas/removeInventorySchema.ts
import { z } from "zod";

export const dispatchInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante do produto inválido"),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro")
    .positive("A quantidade deve ser maior que zero"),

  origin: z.enum(["SALE", "TRANSFER", "RETURN", "MANUAL"]),

  originReferenceId: z.string().uuid("ID de referência inválido").optional(),

  notes: z
    .string()
    .max(500, "As observações devem ter no máximo 500 caracteres")
    .optional(),

  userId: z.string().uuid("ID do usuário inválido"),
});

export type DispatchInventorySchema = z.infer<typeof dispatchInventorySchema>;
