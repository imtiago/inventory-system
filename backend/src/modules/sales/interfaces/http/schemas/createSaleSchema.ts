import { z } from "zod";

export const createSaleSchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        // price: z.number().positive(),
      }),
    )
    .min(1),
  // payment: z.object({
  //   type: z.enum(["cash", "installment"]),
  //   installments: z.number().int().positive().optional(),
  // }),
});
