import { z } from "zod";

export const registerScannedProductSchema = z.object({
  barcode: z.string().min(1, "Barcode is required."),

  boxCode: z.string().min(1, "Box code is required."),

  batchNumber: z.string().optional(),

  expirationDate: z.string().datetime().optional(),
});
