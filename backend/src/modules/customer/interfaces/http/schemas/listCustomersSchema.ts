import { z } from "zod";

export const listCustomersSchema = z.object({
  page: z.coerce
    .number({ error: "Página inválida." })
    .int("Página inválida.")
    .positive("Página inválida.").default(1),
  limit: z.coerce
    .number({ error: "Limite inválido." })
    .int("Limite inválido.")
    .positive("Limite inválido.").default(10),
  search: z.string().trim().optional(),
});
