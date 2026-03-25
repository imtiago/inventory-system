// src/modules/sales/infrastructure/http/controllers/ListSalesController.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { SaleRepository } from "../../../domain/repositories/SaleRepository";
import { ListSales } from "../../../application/useCases/ListSales";
import { z } from "zod";

const listSalesQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export function makeListSalesController(repository: SaleRepository) {
  return async function ListSalesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listSalesQuerySchema.parse(request.query);

      const useCase = new ListSales(repository);
      const sales = await useCase.execute(page, limit);

      return reply.send(sales);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
