import { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ErrorCodes } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { makeGetInventoryByIdUseCase } from "../factories/GetInventoryByIdFactory";
import { getInventoryByIdParamsSchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { HttpResponse } from "@shared/http/response";

export function makeGetInventoryByIdController() {
  const useCase = makeGetInventoryByIdUseCase();
  return async function GetInventoryByIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(getInventoryByIdParamsSchema, request.params);

    const inventory = await useCase.execute(id);
    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    return reply.send(HttpResponse.ok(inventory));
  };
}
