import { z } from "zod";

export const createInventoryLotSchema = z.object({
  productVariantId: z.string().uuid(),

  batchNumber: z.string().min(1, "Batch number is required."),

  expirationDate: z.coerce.date(),

  manufacturingDate: z.coerce.date().optional(),

  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),

  unitCost: z
    .number()
    .nonnegative("Unit cost must be greater than or equal to zero"),
});

export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;
