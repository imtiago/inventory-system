import { PrismaInventoryRepository } from "@inventory/infrastructure/repositories/PrismaInventoryRepository";
import { getInventorySchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeGetInventoryController(
  repository: PrismaInventoryRepository,
) {
  return async function GetInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { variantId } = getInventorySchema.parse(request.params);

      const inventory = await repository.findByVariant(variantId);

      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(inventory);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
