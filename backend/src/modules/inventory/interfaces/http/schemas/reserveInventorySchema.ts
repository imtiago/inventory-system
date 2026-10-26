import { z } from "zod";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { MAX_QUANTITY } from "@shared/domain/limits";

export const reserveInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),

  origin: z.enum(StockMovementOrigin, { message: "Origem inválida." }),

  originId: z.string().uuid("ID de origem inválido."),

  notes: z.string().max(500, "As observações devem ter no máximo 500 caracteres.").optional(),
});

export type ReserveInventorySchema = z.infer<typeof reserveInventorySchema>;
