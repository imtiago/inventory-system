import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeReserveInventory } from "../factories/ReserveInventoryFactory";
import { reserveInventorySchema } from "@inventory/interfaces/http/schemas/reserveInventorySchema";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeReserveInventoryController() {
  const useCase = makeReserveInventory();

  return async function ReserveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = reserveInventorySchema.parse(request.body);
      const movement = await useCase.execute({
        productVariantId: data.productVariantId,
        quantity: data.quantity,
        originId: data.originId,
        notes: data.notes,
        userId: request.user?.sub,
      });

      return reply.send(
        HttpResponse.created(StockMovementOutputMapper.toDTO(movement)),
      );
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
