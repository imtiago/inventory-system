import { z } from "zod";

export const getInventoryByProductVariantBarcodeSchema = z.object({
  barcode: z.string().trim().min(1, "Código de barras inválido."),
});
