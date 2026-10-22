import { z } from "zod";

import { StockMovementType } from "../../../domain/enums/StockMovementType";
import { StockMovementOrigin } from "../../../domain/enums/StockMovementOrigin";

export const listStockMovementsSchema = z.object({
  inventoryId: z.string().uuid("ID do estoque inválido.").optional(),

  productVariantId: z.string().uuid("ID da variante inválido.").optional(),

  type: z.nativeEnum(StockMovementType, { message: "Tipo de movimentação inválido." }).optional(),

  origin: z.nativeEnum(StockMovementOrigin, { message: "Origem da movimentação inválida." }).optional(),

  page: z.coerce.number().int("A página deve ser um número inteiro.").positive("A página deve ser maior que zero.").default(1),

  limit: z.coerce
    .number()
    .int("O limite deve ser um número inteiro.")
    .positive("O limite deve ser maior que zero.")
    .max(100, "O limite deve ser no máximo 100.").default(20),
});
