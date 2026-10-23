import { z } from "zod";
import { isValidCnpj, isValidCpf, normalizeDocument } from "@shared/domain/document";
import { normalizeWhitespace } from "@shared/domain/text/normalizeWhitespace";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

/** Vazio (ou só espaços) vira null; o resto segue para a validação do campo. */
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const nameSchema = z
  .string({ error: "O nome é obrigatório." })
  .transform(normalizeWhitespace)
  .pipe(
    z
      .string()
      .min(2, "O nome deve ter no mínimo 2 caracteres.")
      .max(120, "O nome deve ter no máximo 120 caracteres."),
  );

/** Aceita com ou sem máscara; guarda normalizado (CPF 11 dígitos ou CNPJ 14 posições, numérico ou alfanumérico em maiúsculas; DVs válidos). */
const documentSchema = z
  .string({ error: "O documento é obrigatório." })
  .transform(normalizeDocument)
  .pipe(
    z
      .string()
      .refine((d) => isValidCpf(d) || isValidCnpj(d), "Documento inválido: informe um CPF ou CNPJ válido."),
  );

const emailSchema = z.preprocess(
  blankToNull,
  z.string().trim().toLowerCase().email("E-mail inválido.").max(254, "E-mail inválido.").nullable(),
);

const phoneSchema = z.preprocess(
  (v) => {
    const blank = blankToNull(v);
    if (typeof blank !== "string") return blank;
    return blank.replace(/\D/g, "") || null;
  },
  z
    .string()
    .regex(/^\d{10,11}$/, "O telefone deve ter DDD e 10 ou 11 dígitos.")
    .nullable(),
);

/** POST: nome e documento obrigatórios; opcionais ausentes viram null no use case. */
export const createSupplierBodySchema = z.object({
  name: nameSchema,
  document: documentSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

/** PATCH: pelo menos um campo conhecido; só o que vier é gravado. */
export const updateSupplierBodySchema = z
  .object({
    name: nameSchema.optional(),
    document: documentSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine(
    (body) => Object.values(body).some((v) => v !== undefined),
    "Informe ao menos um campo para atualizar.",
  );

export const supplierIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const listSuppliersSchema = paginationSchema.extend({
  search: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120, "Busca muito longa.").optional(),
  ),
});
