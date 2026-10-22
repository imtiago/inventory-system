// backend/src/modules/catalog/api/schemas/productSchemas.ts
import { z } from "zod";

export const updateProductSchema = z.object({
  name: z.string({ error: "Nome inválido." }).optional(),
  description: z.string({ error: "Descrição inválida." }).optional(),
  price: z.number({ error: "Preço inválido." }).optional(),
  brandId: z.string({ error: "Marca inválida." }).optional(),
  categoryId: z.string({ error: "Categoria inválida." }).optional(),
});
