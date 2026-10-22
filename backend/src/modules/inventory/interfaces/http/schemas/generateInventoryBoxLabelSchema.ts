import { z } from "zod";

export const generateInventoryBoxLabelParamsSchema = z.object({
  code: z.string().trim().min(1, "Código da caixa inválido."),
});

export const generateInventoryProductLabelsBodySchema = z.object({
  productCode: z.string().trim().min(1, "Código do produto inválido."),
  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),
});
