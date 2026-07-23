// src/modules/payables/infrastructure/http/controllers/ListPayablesController.ts
import { ListPayables } from "modules/finance/application/useCases/ListPayables";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";
import { FastifyReply, FastifyRequest } from "fastify";

export function makeListPayablesController(repo: PayableRepository) {
  const useCase = new ListPayables(repo);
  return async function ListPayablesController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const list = await useCase.execute();
    return reply.status(200).send(list);
  };
}
