import type { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { todayInBusinessTz } from "@shared/domain/businessDate";
import { applyCreditReviewSchema } from "@credit/interfaces/http/schemas/creditSchemas";
import { makeRunCreditReviewUseCase } from "@credit/infrastructure/factories/creditFactories";

/** GET /credit/review/preview — o que a revisão mudaria hoje (não grava). */
export function makePreviewCreditReviewController() {
  const useCase = makeRunCreditReviewUseCase();
  return async function PreviewCreditReviewController(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ data: await useCase.preview(todayInBusinessTz()) });
  };
}

/** POST /credit/review/apply — aplica a revisão só aos clientes selecionados (idempotente). */
export function makeApplyCreditReviewController() {
  const useCase = makeRunCreditReviewUseCase();
  return async function ApplyCreditReviewController(request: FastifyRequest, reply: FastifyReply) {
    const { customerIds } = parseInput(applyCreditReviewSchema, request.body ?? {});
    const data = await useCase.apply({ today: todayInBusinessTz(), customerIds, userId: request.user!.sub });
    return reply.send({ data });
  };
}
