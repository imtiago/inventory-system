// src/modules/payables/infrastructure/http/controllers/ListPayablesController.ts
import { ListPayables } from "@payables/application/useCases/ListPayables";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";
import { FastifyReply, FastifyRequest } from "fastify";

export function makeListPayablesController(repo: PayableRepository) {
  return async function ListPayablesController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const useCase = new ListPayables(repo);
    const list = await useCase.execute();
    return reply.status(200).send(list);
  };
}
