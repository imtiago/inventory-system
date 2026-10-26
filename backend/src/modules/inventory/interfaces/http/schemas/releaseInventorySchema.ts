import { z } from "zod";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { MAX_QUANTITY } from "@shared/domain/limits";

export const releaseInventorySchema = z.object({
  inventoryId: z.string().uuid("ID do estoque inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),

  origin: z.enum(StockMovementOrigin, { message: "Origem inválida." }),

  originId: z.string().uuid("ID de origem inválido."),

  notes: z.string().trim().max(500, "As observações devem ter no máximo 500 caracteres.").optional(),
});

export type ReleaseInventoryInput = z.infer<typeof releaseInventorySchema>;
