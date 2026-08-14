import { z } from "zod";

export const getInventoryByProductVariantBarcodeSchema = z.object({
  barcode: z.string(),
});
