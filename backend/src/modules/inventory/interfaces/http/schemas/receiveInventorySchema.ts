import { z } from "zod";
import { MAX_QUANTITY, MAX_UNIT_VALUE } from "@shared/domain/limits";
import { requestDate } from "./requestDate";
import {
  manualNotesSchema,
  manualOriginReferenceIdSchema,
  manualStockOriginSchema,
} from "./manualStockOrigin";

/** Entrada manual: origem só MANUAL/INVENTORY/TRANSFER; lote sempre MANUAL. */
export const receiveInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),

  unitCost: z
    .number()
    .nonnegative("O custo unitário não pode ser negativo.")
    .max(MAX_UNIT_VALUE, "O custo unitário excede o máximo permitido."),

  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório.").optional(),

  expirationDate: requestDate.optional(),

  manufacturingDate: requestDate.optional(),

  origin: manualStockOriginSchema,

  /** Fixo em MANUAL: o campo é aceito só por compatibilidade; outro valor → 400. */
  sourceType: z
    .literal("MANUAL", { message: "Origem do lote inválida: entradas manuais são sempre MANUAL." })
    .optional(),

  originReferenceId: manualOriginReferenceIdSchema,

  notes: manualNotesSchema,
});

export type ReceiveInventoryBody = z.infer<typeof receiveInventorySchema>;
