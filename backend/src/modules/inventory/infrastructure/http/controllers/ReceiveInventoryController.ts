import { FastifyRequest, FastifyReply } from "fastify";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { receiveInventorySchema } from "@inventory/interfaces/http/schemas/receiveInventorySchema";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { HttpResponse } from "@shared/http/response";

export function makeReceiveInventoryController() {
  const useCase = makeReceiveInventory();
  const getInventoryByVariantId = makeGetInventoryByVariantId();
  return async function ReceiveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = receiveInventorySchema.parse(request.body);

      const inventory = await useCase.execute(data);
      const inventoryRead = await getInventoryByVariantId.execute(
        inventory.productVariantId,
      );

      return reply.send(HttpResponse.created(inventoryRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
