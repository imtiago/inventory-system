import { removeInventorySchema } from "@inventory/interfaces/http/schemas/removeInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeRemoveInventory } from "../factories/RemoveInventoryFactory";
export function makeRemoveInventoryController() {
  return async function RemoveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = removeInventorySchema.parse(request.body);

      const useCase = makeRemoveInventory();
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
