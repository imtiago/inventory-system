import { z } from "zod";

import { StockMovementType } from "../../../domain/enums/StockMovementType";
import { StockMovementOrigin } from "../../../domain/enums/StockMovementOrigin";

export const listStockMovementsSchema = z.object({
  inventoryId: z.string().uuid().optional(),

  productVariantId: z.string().uuid().optional(),

  type: z.nativeEnum(StockMovementType).optional(),

  origin: z.nativeEnum(StockMovementOrigin).optional(),

  page: z.coerce.number().int().positive().default(1),

  limit: z.coerce.number().int().positive().max(100).default(20),
});
