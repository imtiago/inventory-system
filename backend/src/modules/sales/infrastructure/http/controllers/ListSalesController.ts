// src/modules/sales/infrastructure/http/controllers/ListSalesController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { makeListSaleUseCase } from "../factories/ListSaleFactory";

const listSalesQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export function makeListSalesController() {
  const useCase = makeListSaleUseCase();
  return async function ListSalesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listSalesQuerySchema.parse(request.query);

      // const sales = await useCase.execute(page, limit);
      const sales = await useCase.execute();

      return reply.send(sales);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
