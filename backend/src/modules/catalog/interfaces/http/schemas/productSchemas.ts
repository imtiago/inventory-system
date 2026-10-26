import { z } from "zod";
import { salePriceSchema } from "./createVariantSchema";
import { createNameSchema } from "@shared/interfaces/http/schemas/nameSchema";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

const nameSchema = createNameSchema({ min: 3, max: 120 });

/** Trim; vazio vira null; até 500 caracteres. */
const descriptionSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z
    .string({ error: "Descrição inválida." })
    .trim()
    .max(500, "A descrição deve ter no máximo 500 caracteres.")
    .nullable()
    .optional(),
);

const brandIdSchema = z.string({ error: "A marca é obrigatória." }).uuid("Marca inválida.");
const categoryIdSchema = z
  .string({ error: "A categoria é obrigatória." })
  .uuid("Categoria inválida.");

export const productIdParamsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export const createProductSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  brandId: brandIdSchema,
  categoryId: categoryIdSchema,
  /** Preço inicial da variante Padrão (cadastro inicial: não exige catalog.price). */
  salePrice: salePriceSchema.optional(),
});

export const updateProductSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    brandId: brandIdSchema.optional(),
    categoryId: categoryIdSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

export const listProductsSchema = paginationSchema.extend({
  search: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(120, "Busca muito longa.").optional(),
  ),
  brandId: brandIdSchema.optional(),
  categoryId: categoryIdSchema.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
