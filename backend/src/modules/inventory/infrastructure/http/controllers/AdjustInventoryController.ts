import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeAdjustInventoryFactory } from "../factories/AdjustInventoryFactory";
import { adjustInventorySchema } from "@inventory/interfaces/http/schemas/adjustInventorySchema";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeAdjustInventoryController() {
  const useCase = makeAdjustInventoryFactory();

  return async function AdjustInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = adjustInventorySchema.parse(request.body);
      const movement = await useCase.execute({
        productVariantId: data.productVariantId,
        countedQuantity: data.countedQuantity,
        notes: data.notes,
        userId: request.user?.sub,
      });

      return reply.send(
        HttpResponse.created(
          movement ? StockMovementOutputMapper.toDTO(movement) : null,
        ),
      );
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
