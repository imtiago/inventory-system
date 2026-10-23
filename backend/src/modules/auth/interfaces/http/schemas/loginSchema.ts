import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "O e-mail é obrigatório." })
    .trim()
    .toLowerCase()
    .email("E-mail inválido."),
  password: z.string({ error: "A senha é obrigatória." }),
});
