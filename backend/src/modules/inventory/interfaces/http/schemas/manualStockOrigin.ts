import { z } from "zod";

/**
 * Origens aceitas nas entradas/saídas manuais. SALE, PURCHASE, RETURN e IMPORT são
 * exclusivas dos serviços internos (venda, compra, cancelamento, importação): uma
 * movimentação manual com essas origens confundiria o cancelamento da venda e o kardex.
 */
export const MANUAL_STOCK_ORIGINS = ["MANUAL", "INVENTORY", "TRANSFER"] as const;

export const manualStockOriginSchema = z.enum(MANUAL_STOCK_ORIGINS, {
  message: "Origem da movimentação inválida: use MANUAL, INVENTORY ou TRANSFER.",
});

export const manualOriginReferenceIdSchema = z.string().uuid("ID de referência inválido.").optional();

export const manualNotesSchema = z
  .string()
  .max(500, "As observações devem ter no máximo 500 caracteres.")
  .optional();
