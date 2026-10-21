import { z } from "zod";

export const createVariantSchema = z.object({
  name: z.string().min(1),
  // sku: z.string().min(1),
  barcode: z.string().optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
