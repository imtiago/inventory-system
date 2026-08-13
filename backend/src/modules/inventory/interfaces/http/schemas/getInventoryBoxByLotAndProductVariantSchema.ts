import { z } from "zod";

export const getInventoryBoxByLotAndProductVariantSchema = z.object({
  productVariantId: z.string().uuid({ message: "Invalid variantId" }),
  batchNumber: z.string(),
});
