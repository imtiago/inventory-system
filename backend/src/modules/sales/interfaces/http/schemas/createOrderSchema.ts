import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  items: z.array(
    z.object({
      productVariantId: z.string().uuid(),
      quantity: z.number().min(1),
      price: z.number().positive(),
    }),
  ),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
