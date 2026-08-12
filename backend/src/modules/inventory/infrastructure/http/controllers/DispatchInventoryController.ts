import { dispatchInventorySchema } from "@inventory/interfaces/http/schemas/dispatchInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeDispatchInventory } from "../factories/DispatchInventoryFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
export function makeDispatchInventoryController() {
  const useCase = makeDispatchInventory();
  const getInventoryByVariantId = makeGetInventoryByVariantId();

  return async function DispatchInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = dispatchInventorySchema.parse(request.body);
      const inventory = await useCase.execute({
        userId: data.userId,
        origin: StockMovementOrigin[data.origin],
        productVariantId: data.productVariantId,
        quantity: data.quantity,
      });
      const inventoryRead = await getInventoryByVariantId.execute(
        inventory.productVariantId,
      );

      return reply.send(HttpResponse.created(inventoryRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
