import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { makeListInventoryLotsByVariantIdUseCase } from "../factories/ListInventoryLotsByVariantIdFactory";
import {
  listInventoryLotsParamsSchema,
  listInvetoryLotsSchema,
} from "@inventory/interfaces/http/schemas/listInvetoryLotsSchema";

export function makeListInventoryLotsByVariantIdController() {
  const useCase = makeListInventoryLotsByVariantIdUseCase();
  return async function ListInventoryLotsByVariantIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = parseInput(listInvetoryLotsSchema, request.query);

    const { productVariantId } = parseInput(listInventoryLotsParamsSchema, request.params);

    const data = await useCase.execute({ page, limit, productVariantId });

    return reply.send(HttpResponse.paginated(data));
  };
}
