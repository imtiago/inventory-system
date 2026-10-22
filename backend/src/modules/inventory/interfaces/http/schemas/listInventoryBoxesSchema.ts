import { z } from "zod";

export const listInventoryBoxesSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int("A página deve ser um número inteiro.").positive("A página deve ser maior que zero.").default(1),
  limit: z.coerce
    .number()
    .int("O limite deve ser um número inteiro.")
    .positive("O limite deve ser maior que zero.")
    .max(100, "O limite deve ser no máximo 100.").default(10),
});
