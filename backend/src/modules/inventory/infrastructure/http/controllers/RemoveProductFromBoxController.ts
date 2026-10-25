import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { makeRemoveProductFromBoxUseCase } from "../factories/RemoveProductFromBoxFactory";
import {
  removeProductFromBoxBodySchema,
  removeProductFromBoxParamsSchema,
} from "@inventory/interfaces/http/schemas/removeProductFromBoxSchema";

export function makeRemoveProductFromBoxController() {
  const useCase = makeRemoveProductFromBoxUseCase();

  return async function RemoveProductFromBoxController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { boxId } = parseInput(removeProductFromBoxParamsSchema, request.params);
    const { inventoryLotId, quantity } = parseInput(removeProductFromBoxBodySchema, request.body);

    const data = await useCase.execute({ boxId, inventoryLotId, quantity });

    return reply.send(HttpResponse.ok(data));
  };
}
