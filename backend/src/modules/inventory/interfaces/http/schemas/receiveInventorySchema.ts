import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
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

  sourceType: z.nativeEnum(InventoryLotSource),

  originReferenceId: z.string().optional(),

  notes: z.string().optional(),
});

export type ReceiveInventoryBody = z.infer<typeof receiveInventorySchema>;
