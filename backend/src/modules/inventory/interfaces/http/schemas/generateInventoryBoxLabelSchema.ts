import { z } from "zod";
import { MAX_PRODUCT_CODE_LENGTH, MAX_PRODUCT_LABELS } from "@inventory/domain/labelLimits";

export const generateInventoryBoxLabelParamsSchema = z.object({
  code: z.string().trim().min(1, "Código da caixa inválido."),
});

export const generateInventoryProductLabelsBodySchema = z.object({
  productCode: z
    .string()
    .trim()
    .min(1, "Código do produto inválido.")
    .max(MAX_PRODUCT_CODE_LENGTH, `O código do produto deve ter no máximo ${MAX_PRODUCT_CODE_LENGTH} caracteres.`),
  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_PRODUCT_LABELS, `A quantidade deve ser no máximo ${MAX_PRODUCT_LABELS} etiquetas.`),
});
