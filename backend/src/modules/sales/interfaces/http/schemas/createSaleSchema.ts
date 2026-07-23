import { z } from "zod";
const saleDiscountSchema = z
  .object({
    type: z.enum(["VALUE", "PERCENTAGE"]),

    value: z.number().nonnegative(),
  })
  .superRefine((discount, ctx) => {
    if (discount.type === "PERCENTAGE" && discount.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discount cannot exceed 100%.",
      });
    }
  });

const saleItemSchema = z.object({
  productVariantId: z.string().uuid(),

  quantity: z.number().int().positive(),

  discount: saleDiscountSchema.optional(),
});

export const createSaleSchema = z
  .object({
    customerId: z.string().uuid(),

    sellerId: z.string().uuid(),

    notes: z.string().trim().max(500).optional(),
    discount: saleDiscountSchema.optional(),

    items: z.array(saleItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();

    data.items.forEach((item, index) => {
      if (ids.has(item.productVariantId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate product variant.",
          path: ["items", index, "productVariantId"],
        });
      }

      ids.add(item.productVariantId);
    });
  });
