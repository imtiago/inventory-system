import { z } from "zod";

/** Trim; vazio/só espaços vira `fallback` (o código de barras é opcional e único). */
export const blankTo = (fallback: null | undefined) => (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
};

export const salePriceSchema = z
  .number({ error: "O preço de venda deve ser um número." })
  .min(0, "O preço de venda não pode ser negativo.")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "O preço deve ter no máximo 2 casas decimais.");

export const createVariantSchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
  // sku: z.string().min(1),
  barcode: z.preprocess((v) => (v === null ? undefined : blankTo(undefined)(v)), z.string().optional()),
  salePrice: salePriceSchema.optional(),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
