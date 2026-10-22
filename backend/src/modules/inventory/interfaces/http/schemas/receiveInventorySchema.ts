import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { z } from "zod";
import { requestDate } from "./requestDate";

export const receiveInventorySchema = z.object({
  productVariantId: z.string().uuid("ID da variante inválido."),

  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),

  unitCost: z.number().nonnegative("O custo unitário não pode ser negativo."),

  batchNumber: z.string().trim().min(1, "O número do lote é obrigatório.").optional(),

  expirationDate: requestDate.optional(),

  manufacturingDate: requestDate.optional(),

  origin: z.nativeEnum(StockMovementOrigin, { message: "Origem da movimentação inválida." }),

  sourceType: z.nativeEnum(InventoryLotSource, { message: "Origem do lote inválida." }),

  originReferenceId: z.string().optional(),

  notes: z.string().optional(),
});

export type ReceiveInventoryBody = z.infer<typeof receiveInventorySchema>;
