import { z } from "zod";
import { MAX_QUANTITY } from "@shared/domain/limits";

export const addProductToBoxParamsSchema = z.object({
  boxId: z.string().uuid("ID da caixa inválido."),
});

export const addProductToBoxBodySchema = z.object({
  inventoryLotId: z.string().uuid("ID do lote inválido."),
  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero.")
    .max(MAX_QUANTITY, "Quantidade excede o máximo permitido."),
});

export const addProductToBoxSchema = {
  params: addProductToBoxParamsSchema,
  body: addProductToBoxBodySchema,
};
