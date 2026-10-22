import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string({ error: "O nome é obrigatório." }).min(1, "O nome é obrigatório."),
  email: z.string({ error: "O e-mail é obrigatório." }).email("E-mail inválido."),
  password: z
    .string({ error: "A senha é obrigatória." })
    .min(6, "A senha deve ter ao menos 6 caracteres."),
  // role: z.enum(["ADMIN", "VENDEDOR", "ESTOQUISTA"]),
});
