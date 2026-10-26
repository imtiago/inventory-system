import { z } from "zod";
import { createNameSchema } from "@shared/interfaces/http/schemas/nameSchema";
import { barcodeString, blankTo, salePriceSchema } from "./createVariantSchema";

export const updateVariantSchema = z
  .object({
    name: createNameSchema({ max: 120 }).optional(),
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
