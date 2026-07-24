// src/modules/receivables/infrastructure/http/controllers/ListReceivablesController.ts
import { ListReceivables } from "modules/finance/application/useCases/ListReceivables";
import { ReceivableRepository } from "modules/finance/domain/repositories/ReceivableRepository";
import { FastifyReply, FastifyRequest } from "fastify";
import { makeListReceivableUseCase } from "../factories/ListReceivableFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListReceivablesController() {
  const useCase = makeListReceivableUseCase();
  return async function ListReceivablesController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    // const useCase = new ListReceivables(repo);
    const { page, limit } = paginationSchema.parse(req.query);

    const list = await useCase.execute({ page, limit });
    return reply.status(200).send(list);
  };
}
