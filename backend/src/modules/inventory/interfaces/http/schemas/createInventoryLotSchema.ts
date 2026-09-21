import { z } from "zod";

export const createInventoryLotSchema = z.object({
  productVariantId: z.string().uuid(),
  batchNumber: z.string().min(1, "Batch number is required."),
  expirationDate: z.string().datetime("Invalid ISO datetime"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
});

export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;
