import { z } from "zod";

export const reserveInventorySchema = z.object({
  productVariantId: z.string().uuid(),

  quantity: z.number().int().positive("Quantity must be greater than zero"),

  originId: z.string().uuid(),

  notes: z.string().max(500).optional(),

  userId: z.string().uuid(),
});

export type ReserveInventorySchema = z.infer<typeof reserveInventorySchema>;
