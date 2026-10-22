import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { makeListInventoryUseCase } from "../factories/ListInventoryFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import { HttpResponse } from "@shared/http/response";

export function makeListInventoryController() {
  const useCase = makeListInventoryUseCase();
  return async function ListInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = parseInput(paginationSchema, request.query);

    const listInventory = await useCase.execute({ page, limit });

    return reply.send(HttpResponse.paginated(listInventory));
  };
}
