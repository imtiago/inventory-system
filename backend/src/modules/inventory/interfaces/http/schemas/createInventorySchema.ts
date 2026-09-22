import { z } from "zod";

export const createInventorySchema = z.object({
  productVariantId: z.string().uuid(),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
