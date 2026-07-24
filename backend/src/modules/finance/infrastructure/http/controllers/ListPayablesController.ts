// src/modules/payables/infrastructure/http/controllers/ListPayablesController.ts
import { ListPayables } from "modules/finance/application/useCases/ListPayables";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";
import { FastifyReply, FastifyRequest } from "fastify";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListPayablesController(repo: PayableRepository) {
  const useCase = new ListPayables(repo);
  return async function ListPayablesController(
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = paginationSchema.parse(req.query);

    const list = await useCase.execute({ page, limit });
    return reply.status(200).send(list);
  };
}
