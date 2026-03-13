import { z } from "zod";

export const updateOrderSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "SHIPPED"]),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
