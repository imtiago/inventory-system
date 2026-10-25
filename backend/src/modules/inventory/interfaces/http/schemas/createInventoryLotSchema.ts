import { z } from "zod";
import { MAX_QUANTITY, MAX_UNIT_VALUE } from "@shared/domain/limits";
import { requestDate } from "./requestDate";

export const createInventoryLotSchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório."),

  expirationDate: requestDate,

  manufacturingDate: requestDate.optional(),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),

  unitCost: z
    .number()
    .nonnegative("O custo unitário não pode ser negativo.")
    .max(MAX_UNIT_VALUE, "O custo unitário excede o máximo permitido."),
});

export type CreateInventoryLotInput = z.infer<typeof createInventoryLotSchema>;
