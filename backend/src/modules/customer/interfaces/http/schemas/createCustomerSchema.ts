import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome é obrigatório.")
    .transform((value) => value.toLowerCase()),
  email: z.string().email("E-mail inválido.").nullable(),
  phone: z
    .string()
    .nullable()
    .transform((value) => value?.replace(/\D/g, "") || null)
    .refine(
      (value) => value === null || value.length === 10 || value.length === 11,
      "O telefone deve ter DDD e 10 ou 11 dígitos.",
    ),
  address: z.string().nullable(),
});
