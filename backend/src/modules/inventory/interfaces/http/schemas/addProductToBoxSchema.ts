import { z } from "zod";

export const addProductToBoxParamsSchema = z.object({
  boxId: z.string().uuid(),
});

export const addProductToBoxBodySchema = z.object({
  inventoryLotId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const addProductToBoxSchema = {
  params: addProductToBoxParamsSchema,
  body: addProductToBoxBodySchema,
};
