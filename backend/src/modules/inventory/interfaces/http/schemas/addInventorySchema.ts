// backend/src/modules/inventory/interfaces/http/schemas/addInventorySchema.ts
import { z } from "zod";

export const addInventorySchema = z.object({
  productVariantId: z.string().uuid({ message: "Invalid productVariantId" }),
  quantity: z
    .number()
    .int()
    .positive({ message: "Quantity must be greater than 0" }),
});
