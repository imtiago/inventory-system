import { FastifyRequest, FastifyReply } from "fastify";
import { SaleRepository } from "../../../domain/repositories/SaleRepository";
import { ListSales } from "../../../application/useCases/ListSales";

export async function ListSalesController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { page = 1, limit = 10 } = request.query as any;
  const useCase = new ListSales(saleRepo);

  const sales = await useCase.execute(Number(page), Number(limit));
  return reply.send(sales);
}
