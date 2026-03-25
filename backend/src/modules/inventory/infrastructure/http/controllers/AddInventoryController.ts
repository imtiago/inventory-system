import { AddInventory } from "@inventory/application/useCases/AddInventory";
import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { addInventorySchema } from "@inventory/interfaces/http/schemas/addInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeAddInventoryController(
  repository: PrismaInventoryRepository,
) {
  return async function AddInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = addInventorySchema.parse(request.body);

      const useCase = new AddInventory(repository);

      const inventory = await useCase.execute(
        data.productVariantId,
        data.quantity,
      );

      return reply.status(201).send(inventory);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
