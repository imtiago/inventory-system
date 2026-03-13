// backend/src/modules/inventory/interfaces/http/schemas/removeInventorySchema.ts
import { z } from "zod";

export const removeInventorySchema = z.object({
  productVariantId: z.string().uuid({ message: "Invalid productVariantId" }),
  quantity: z
    .number()
    .int()
    .positive({ message: "Quantity must be greater than 0" }),
});
