import { getInventorySchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetInventory } from "../factories/GetInventoryFactory";

export function makeGetInventoryController() {
  return async function GetInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { variantId } = getInventorySchema.parse(request.params);

      const useCase = makeGetInventory();
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
