import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { z } from "zod";

export const receiveInventorySchema = z.object({
  productVariantId: z.string().uuid(),

  quantity: z.number().int().positive(),

  unitCost: z.number().nonnegative(),

  batchNumber: z.string().optional(),

  expirationDate: z.coerce.date().optional(),

  manufacturingDate: z.coerce.date().optional(),

  origin: z.nativeEnum(StockMovementOrigin),

  originReferenceId: z.string().optional(),

  notes: z.string().optional(),

  userId: z.string().uuid(),
});

export type ReceiveInventoryBody = z.infer<typeof receiveInventorySchema>;
