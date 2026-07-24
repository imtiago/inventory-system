// src/modules/sales/infrastructure/http/controllers/ListSalesController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { makeListSaleUseCase } from "../factories/ListSaleFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListSalesController() {
  const useCase = makeListSaleUseCase();
  return async function ListSalesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = paginationSchema.parse(request.query);

      // const sales = await useCase.execute(page, limit);
      const sales = await useCase.execute({ page, limit });

      return reply.send(sales);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
