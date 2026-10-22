import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { dispatchInventorySchema } from "@inventory/interfaces/http/schemas/dispatchInventorySchema";
import { makeDispatchInventory } from "../factories/DispatchInventoryFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeDispatchInventoryController() {
  const useCase = makeDispatchInventory();

  return async function DispatchInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = dispatchInventorySchema.parse(request.body);
      const movements = await useCase.execute({
        productVariantId: data.productVariantId,
        quantity: data.quantity,
        origin: StockMovementOrigin[data.origin],
        originReferenceId: data.originReferenceId,
        notes: data.notes,
        userId: request.user?.sub,
      });

      return reply.send(
        HttpResponse.created(
          movements.map((m) => StockMovementOutputMapper.toDTO(m)),
        ),
      );
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
