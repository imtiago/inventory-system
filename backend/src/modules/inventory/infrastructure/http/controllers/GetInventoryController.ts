import { getInventorySchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListInventoryUseCase } from "../factories/ListInventoryFactory";

export function makeGetInventoryController() {
  const useCase = makeListInventoryUseCase();
  return async function GetInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { variantId } = getInventorySchema.parse(request.params);

      const inventory = await useCase.execute(variantId);

      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(inventory);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
