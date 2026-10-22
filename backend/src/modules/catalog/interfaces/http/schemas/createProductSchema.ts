import { z } from "zod";

export const createProductSchema = z.object({
  name: z
    .string({ error: "O nome é obrigatório." })
    .min(3, "O nome deve ter ao menos 3 caracteres."),
  description: z.string().optional(),
  brandId: z
    .string({ error: "A marca é obrigatória." })
    .uuid("Marca inválida."),
  categoryId: z
    .string({ error: "A categoria é obrigatória." })
    .uuid("Categoria inválida."),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
