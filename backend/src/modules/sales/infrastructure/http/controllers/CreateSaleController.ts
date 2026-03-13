import { FastifyRequest, FastifyReply } from "fastify";
import { CreateSale } from "../../../application/useCases/CreateSale";
import { SaleRepository } from "../../../domain/repositories/SaleRepository";
import { PrismaInventoryRepository } from "../../../../inventory/infrastructure/repositories/PrismaInventoryRepository";

export async function CreateSaleController(
  request: FastifyRequest,
  reply: FastifyReply,
  saleRepo: SaleRepository,
) {
  const inventoryRepo = new PrismaInventoryRepository();
  const useCase = new CreateSale(saleRepo, inventoryRepo);
  const data = request.body as any;

  try {
    const sale = await useCase.execute(data);
    return reply.send(sale);
  } catch (err: any) {
    return reply.status(400).send({ message: err.message });
  }
}
