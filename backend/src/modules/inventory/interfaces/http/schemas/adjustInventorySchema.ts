import { z } from "zod";

export const adjustInventorySchema = z.object({
  productVariantId: z.string().uuid(),

  countedQuantity: z.number().int().nonnegative(),

  notes: z.string().max(500).optional(),
});

export type AdjustInventoryRequest = z.infer<typeof adjustInventorySchema>;
