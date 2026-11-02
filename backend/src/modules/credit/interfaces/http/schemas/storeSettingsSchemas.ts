import { z } from "zod";
import { isValidCnpj, normalizeDocument } from "@shared/domain/document";
import { normalizeWhitespace } from "@shared/domain/text/normalizeWhitespace";
import { createNameSchema } from "@shared/interfaces/http/schemas/nameSchema";

export const updateStoreSettingsSchema = z
  .object({
    name: createNameSchema({ min: 2, max: 120 }),
    cnpj: z
      .string({ error: "CNPJ inválido." })
      .transform(normalizeDocument)
      .pipe(z.string().refine(isValidCnpj, "CNPJ inválido.")),
    address: z
      .string({ error: "O endereço é obrigatório." })
      .transform(normalizeWhitespace)
      .pipe(z.string().min(5, "O endereço deve ter no mínimo 5 caracteres.").max(250, "O endereço deve ter no máximo 250 caracteres.")),
    phone: z
      .string({ error: "O telefone deve ter DDD e 10 ou 11 dígitos." })
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{10,11}$/, "O telefone deve ter DDD e 10 ou 11 dígitos.")),
  })
  .strict();

export const carneParamsSchema = z.object({ id: z.string().uuid("Venda inválida.") });
export const receiptParamsSchema = z.object({ paymentId: z.string().uuid("Pagamento inválido.") });
