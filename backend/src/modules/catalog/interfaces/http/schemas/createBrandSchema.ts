// backend/src/modules/catalog/interfaces/http/schemas/createBrandSchema.ts
import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1),
});
