import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { makeAddProductToBoxUseCase } from "../factories/AddProductToBoxFactory";
import {
  addProductToBoxBodySchema,
  addProductToBoxParamsSchema,
} from "@inventory/interfaces/http/schemas/addProductToBoxSchema";

export function makeAddProductToBoxController() {
  const useCase = makeAddProductToBoxUseCase();

  return async function AddProductToBoxController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { boxId } = parseInput(addProductToBoxParamsSchema, request.params);
    const { inventoryLotId, quantity } = parseInput(addProductToBoxBodySchema, request.body);

    const dt = await useCase.execute({ boxId, inventoryLotId, quantity });

    return reply.send(HttpResponse.created(dt));
  };
}
