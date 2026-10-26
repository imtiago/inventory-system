import { z } from "zod";
import { barcodeString, blankTo, salePriceSchema } from "./createVariantSchema";

export const updateVariantSchema = z
  .object({
    name: z.string({ error: "O nome é inválido." }).min(1, "O nome é obrigatório.").optional(),
    barcode: z.preprocess(
      blankTo(null),
      barcodeString.nullable().optional(),
    ),
    salePrice: salePriceSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
