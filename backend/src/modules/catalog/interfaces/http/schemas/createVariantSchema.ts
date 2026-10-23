import { z } from "zod";

export const salePriceSchema = z
  .number({ error: "O preço de venda deve ser um número." })
  .min(0, "O preço de venda não pode ser negativo.")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "O preço deve ter no máximo 2 casas decimais.");

export const createVariantSchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
  // sku: z.string().min(1),
  barcode: z.string().optional(),
  salePrice: salePriceSchema.optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
