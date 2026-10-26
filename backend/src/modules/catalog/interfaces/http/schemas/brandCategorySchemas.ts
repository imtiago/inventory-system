import { z } from "zod";
import { createNameSchema } from "@shared/interfaces/http/schemas/nameSchema";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

/** Nome de marca/categoria: trim + espaços internos colapsados, 1–80 caracteres. */
const nameSchema = createNameSchema({ max: 80 });

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
