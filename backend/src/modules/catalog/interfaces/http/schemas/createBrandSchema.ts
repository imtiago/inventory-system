// backend/src/modules/catalog/interfaces/http/schemas/createBrandSchema.ts
import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
});
