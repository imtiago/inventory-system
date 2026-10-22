import { z } from "zod";

export const addProductToBoxParamsSchema = z.object({
  boxId: z.string().uuid("ID da caixa inválido."),
});

export const addProductToBoxBodySchema = z.object({
  inventoryLotId: z.string().uuid("ID do lote inválido."),
  quantity: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .positive("A quantidade deve ser maior que zero."),
});

export const addProductToBoxSchema = {
  params: addProductToBoxParamsSchema,
  body: addProductToBoxBodySchema,
};
