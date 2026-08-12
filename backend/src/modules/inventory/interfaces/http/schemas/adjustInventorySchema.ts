import { z } from "zod";

import { StockMovementOrigin } from "../../../domain/enums/StockMovementOrigin";

export const adjustInventorySchema = z.object({
  productVariantId: z.string().uuid(),

  quantity: z.number().int().nonnegative(),

  origin: z.nativeEnum(StockMovementOrigin),

  userId: z.string().uuid().optional(),

  notes: z.string().optional(),
});

export type AdjustInventoryRequest = z.infer<typeof adjustInventorySchema>;
