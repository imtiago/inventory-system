import { z } from "zod";

export const createVariantSchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
  // sku: z.string().min(1),
  barcode: z.string().optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
