import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { z } from "zod";
import { requestDate } from "./requestDate";

export const receiveInventorySchema = z.object({
  productVariantId: z.string().uuid(),

  quantity: z.number().int().positive(),

  unitCost: z.number().nonnegative(),

  batchNumber: z.string().trim().min(1).optional(),

  expirationDate: requestDate.optional(),

  manufacturingDate: requestDate.optional(),

  origin: z.nativeEnum(StockMovementOrigin),

  sourceType: z.nativeEnum(InventoryLotSource),

  originReferenceId: z.string().optional(),

  notes: z.string().optional(),
});

export type ReceiveInventoryBody = z.infer<typeof receiveInventorySchema>;
