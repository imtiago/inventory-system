// backend/src/modules/catalog/api/schemas/productSchemas.ts
import { z } from "zod";

export const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
});
