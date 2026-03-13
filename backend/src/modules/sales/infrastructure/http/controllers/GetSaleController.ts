import { FastifyRequest, FastifyReply } from "fastify";
import { SaleRepository } from "../../../domain/repositories/SaleRepository";
import { GetSale } from "../../../application/useCases/GetSale";

export async function GetSaleController(
  request: FastifyRequest,
  reply: FastifyReply,
  saleRepo: SaleRepository,
) {
  const { id } = request.params as { id: string };
  const useCase = new GetSale(saleRepo);

  const sale = await useCase.execute(id);

  if (!sale) {
    return reply.status(404).send({ message: "Sale not found" });
  }

  return reply.send(sale);
}
