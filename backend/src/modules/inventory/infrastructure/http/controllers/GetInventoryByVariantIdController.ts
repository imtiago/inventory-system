import { getInventorySchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ErrorCodes } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { HttpResponse } from "@shared/http/response";

export function makeGetInventoryByVariantIdController() {
  const useCase = makeGetInventoryByVariantId();
  return async function GetInventoryByVariantIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { variantId } = parseInput(getInventorySchema, request.params);

    const inventory = await useCase.execute(variantId);

    if (!inventory) {
      throw new NotFoundError("Estoque não encontrado.", ErrorCodes.INVENTORY_NOT_FOUND);
    }

    return reply.send(HttpResponse.ok(inventory));
  };
}
