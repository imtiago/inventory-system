import { RemoveInventory } from "@inventory/application/useCases/RemoveInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { removeInventorySchema } from "@inventory/interfaces/http/schemas/removeInventorySchema";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { FastifyRequest, FastifyReply } from "fastify";
export function makeRemoveInventoryController(
  repository: PrismaInventoryRepository,
  transaction: TransactionManager,
) {
  return async function RemoveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = removeInventorySchema.parse(request.body);

      const useCase = new RemoveInventory(repository, transaction);

      const inventory = await useCase.execute(
        data.productVariantId,
        data.quantity,
      );

      return reply.send(inventory);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
