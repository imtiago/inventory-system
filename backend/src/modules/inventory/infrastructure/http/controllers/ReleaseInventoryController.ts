import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeReleaseInventoryFactory } from "../factories/ReleaseInventoryFactory";
import { releaseInventorySchema } from "@inventory/interfaces/http/schemas/releaseInventorySchema";
import { StockMovementOutputMapper } from "@inventory/application/mappers/StockMovementOutputMapper";

export function makeReleaseInventoryController() {
  const useCase = makeReleaseInventoryFactory();

  return async function ReleaseInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = releaseInventorySchema.parse(request.body);
      const movement = await useCase.execute({
        inventoryId: data.inventoryId,
        quantity: data.quantity,
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
