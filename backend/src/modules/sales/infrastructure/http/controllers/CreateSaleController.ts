import { FastifyRequest, FastifyReply } from "fastify";
import { CreateSale } from "../../../application/useCases/CreateSale";
import { createSaleSchema } from "../../../interfaces/http/schemas/createSaleSchema";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { ReceivableRepository } from "modules/finance/domain/repositories/ReceivableRepository";
import { SaleRepository } from "modules/sales/domain/repositories/SaleRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";

export function makeCreateSaleController(
  inventoryRepo: InventoryRepository,
  saleRepo: SaleRepository,
  receivableRepository: ReceivableRepository,
  transaction: TransactionManager,
) {
  return async function CreateSaleController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createSaleSchema.parse(request.body);

      const useCase = new CreateSale(
        saleRepo,
        inventoryRepo,
        receivableRepository,
        transaction,
      );
      const sale = await useCase.execute(data);

      return reply.status(201).send(sale);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
