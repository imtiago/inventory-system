import { z } from "zod";
import { normalizeWhitespace } from "@shared/domain/text/normalizeWhitespace";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

/** Nome de marca/categoria: trim + espaços internos colapsados, 1–80 caracteres. */
const nameSchema = z
  .string({ error: "O nome é obrigatório." })
  .transform(normalizeWhitespace)
  .pipe(
    z
      .string()
      .min(1, "O nome é obrigatório.")
      .max(80, "O nome deve ter no máximo 80 caracteres."),
  );

/** Corpo de POST e PUT (o PUT só tem o nome, então ele é obrigatório). */
export const brandCategoryBodySchema = z.object({ name: nameSchema });

export const brandCategoryIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const listBrandCategorySchema = paginationSchema.extend({
  search: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(80, "Busca muito longa.").optional(),
  ),
});
