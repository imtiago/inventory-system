import { z } from "zod";

export const releaseInventorySchema = z.object({
  inventoryId: z.string().uuid(),

  quantity: z.number().int().positive(),

  userId: z.string().uuid(),

  notes: z.string().trim().optional(),
});

export type ReleaseInventoryInput = z.infer<typeof releaseInventorySchema>;
