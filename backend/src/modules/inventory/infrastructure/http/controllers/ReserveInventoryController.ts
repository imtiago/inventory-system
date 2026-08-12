import { FastifyRequest, FastifyReply } from "fastify";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { makeReserveInventory } from "../factories/ReserveInventoryFactory";
import { reserveInventorySchema } from "@inventory/interfaces/http/schemas/reserveInventorySchema";
export function makeReserveInventoryController() {
  const useCase = makeReserveInventory();
  const getInventoryByVariantId = makeGetInventoryByVariantId();

  return async function ReserveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = reserveInventorySchema.parse(request.body);
      const moviment = await useCase.execute({
        originId: data.originId,
        productVariantId: data.productVariantId,
        quantity: data.quantity,
        notes: data.notes,
        userId: data.userId,
      });
      const movimentRead = await getInventoryByVariantId.execute(
        moviment.productVariantId,
      );

      return reply.send(HttpResponse.created(movimentRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
