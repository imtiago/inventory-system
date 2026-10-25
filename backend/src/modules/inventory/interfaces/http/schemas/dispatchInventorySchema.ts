import { z } from "zod";
import { MAX_QUANTITY } from "@shared/domain/limits";
import {
  manualNotesSchema,
  manualOriginReferenceIdSchema,
  manualStockOriginSchema,
} from "./manualStockOrigin";

/** Saída manual: origem só MANUAL/INVENTORY/TRANSFER (venda/devolução são internas). */
export const dispatchInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),

  origin: manualStockOriginSchema,

  originReferenceId: manualOriginReferenceIdSchema,

  notes: manualNotesSchema,
});

export type DispatchInventorySchema = z.infer<typeof dispatchInventorySchema>;
