import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { receivableParamsSchema } from "@finance/interfaces/http/schemas/receivableQuerySchema";
import { makeGetReceivableByIdUseCase } from "../factories/ListReceivableFactory";

export function makeGetReceivableController() {
  const useCase = makeGetReceivableByIdUseCase();
  return async function GetReceivableController(req: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(receivableParamsSchema, req.params);

    const receivable = await useCase.execute(id);
    return reply.send({ data: receivable });
  };
}
