import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { makeListStockMovementsUseCase } from "../factories/ListStockMovementsFactory";
import { listStockMovementsSchema } from "@inventory/interfaces/http/schemas/listStockMovementsSchema";

export function makeListStockMovementsController() {
  const useCase = makeListStockMovementsUseCase();
  return async function ListStockMovementsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const query = parseInput(listStockMovementsSchema, request.query);

    const data = await useCase.execute(query);

    return reply.send(HttpResponse.paginated(data));
  };
}
