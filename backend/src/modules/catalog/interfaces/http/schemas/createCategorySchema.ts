// backend/src/modules/catalog/interfaces/http/schemas/createCategorySchema.ts
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
});
