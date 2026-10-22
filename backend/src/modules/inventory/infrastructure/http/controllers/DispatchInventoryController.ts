import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
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
    const data = parseInput(dispatchInventorySchema, request.body);
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
  };
}
