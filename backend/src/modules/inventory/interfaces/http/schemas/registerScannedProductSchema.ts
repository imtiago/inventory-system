import { z } from "zod";
import { requestDate } from "./requestDate";

export const registerScannedProductSchema = z.object({
  barcode: z.string().min(1, "O código de barras é obrigatório."),

  boxCode: z.string().min(1, "O código da caixa é obrigatório."),

  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório.").optional(),

  expirationDate: requestDate.optional(),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .min(1, "A quantidade deve ser maior que zero.")
    .default(1),

  unitCost: z.number().nonnegative("O custo unitário não pode ser negativo.").optional(),
});
