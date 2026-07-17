// src/modules/receivables/infrastructure/http/controllers/ListReceivablesController.ts
import { ListReceivables } from "modules/finance/application/useCases/ListReceivables";
import { ReceivableRepository } from "modules/finance/domain/repositories/ReceivableRepository";
import { FastifyReply, FastifyRequest } from "fastify";

export function makeListReceivablesController(repo: ReceivableRepository) {
  return async function ListReceivablesController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const useCase = new ListReceivables(repo);
    const list = await useCase.execute();
    return reply.status(200).send(list);
  };
}
