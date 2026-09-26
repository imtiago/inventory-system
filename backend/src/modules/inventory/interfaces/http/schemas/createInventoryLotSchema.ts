import { z } from "zod";

export const createInventoryLotSchema = z.object({
  productVariantId: z.string().uuid(),

  batchNumber: z.string().min(1, "Batch number is required."),

  expirationDate: z.string("Invalid ISO datetime"),
  // expirationDate: z.date("Invalid ISO datetime"),
  // expirationDate: z.date("Invalid ISO datetime").datetime("Invalid ISO datetime"),

  manufacturingDate: z.string().optional(),
  // manufacturingDate: z.date().optional(),
  // manufacturingDate: z
  //   .string()
  //   .datetime("Invalid ISO datetime")
  //   .optional(),

  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),

  unitCost: z
    .number()
    .nonnegative("Unit cost must be greater than or equal to zero"),
});

export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;
