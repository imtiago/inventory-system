import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { listReceivablesQuerySchema } from "@finance/interfaces/http/schemas/receivableQuerySchema";
import { makeListReceivableUseCase } from "../factories/ListReceivableFactory";

export function makeListReceivablesController() {
  const useCase = makeListReceivableUseCase();
  return async function ListReceivablesController(req: FastifyRequest, reply: FastifyReply) {
    const { page, limit, ...filters } = parseInput(listReceivablesQuerySchema, req.query);

    // { data, pagination, summary }
    const result = await useCase.execute(filters, { page, limit });
    return reply.status(200).send(result);
  };
}
