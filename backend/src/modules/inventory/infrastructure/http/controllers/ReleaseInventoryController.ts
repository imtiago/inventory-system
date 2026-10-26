import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { makeReleaseInventoryFactory } from "../factories/ReleaseInventoryFactory";
import { releaseInventorySchema } from "@inventory/interfaces/http/schemas/releaseInventorySchema";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeReleaseInventoryController() {
  const useCase = makeReleaseInventoryFactory();

  return async function ReleaseInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(releaseInventorySchema, request.body);
    const movement = await useCase.execute({
      inventoryId: data.inventoryId,
      quantity: data.quantity,
      origin: StockMovementOrigin[data.origin],
      originId: data.originId,
      notes: data.notes,
      userId: request.user?.sub,
    });

    return reply.send(
      HttpResponse.created(StockMovementOutputMapper.toDTO(movement)),
    );
  };
}
