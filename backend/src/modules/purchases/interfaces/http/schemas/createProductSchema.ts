import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  brandId: z.string().uuid(),
  categoryId: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
