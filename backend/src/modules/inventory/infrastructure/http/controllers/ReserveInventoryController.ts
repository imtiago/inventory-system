import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { makeReserveInventory } from "../factories/ReserveInventoryFactory";
import { reserveInventorySchema } from "@inventory/interfaces/http/schemas/reserveInventorySchema";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeReserveInventoryController() {
  const useCase = makeReserveInventory();

  return async function ReserveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(reserveInventorySchema, request.body);
    const movement = await useCase.execute({
      productVariantId: data.productVariantId,
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
