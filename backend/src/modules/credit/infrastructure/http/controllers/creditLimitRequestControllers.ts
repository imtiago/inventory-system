import type { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { toCents } from "@shared/domain/money";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import {
  approveLimitRequestSchema,
  createLimitRequestSchema,
  limitRequestParamsSchema,
  limitRequestsQuerySchema,
  rejectLimitRequestSchema,
} from "@credit/interfaces/http/schemas/creditSchemas";
import {
  makeApproveCreditLimitRequestUseCase,
  makeListCreditLimitRequestsUseCase,
  makeRejectCreditLimitRequestUseCase,
  makeRequestCreditLimitUseCase,
} from "@credit/infrastructure/factories/creditFactories";

/** POST /credit/limit-requests — vendedor pede aumento (credit.request, idempotente). */
export function makeRequestCreditLimitController() {
  const useCase = makeRequestCreditLimitUseCase();
  return async function RequestCreditLimitController(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(createLimitRequestSchema, request.body ?? {});
    const data = await useCase.execute({
      customerId: body.customerId,
      requestedLimitCents: toCents(body.requestedLimit),
      reason: body.reason,
      userId: request.user!.sub,
    });
    return reply.status(201).send({ data });
  };
}

export function makeApproveCreditLimitRequestController() {
  const useCase = makeApproveCreditLimitRequestUseCase();
  return async function ApproveCreditLimitRequestController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(limitRequestParamsSchema, request.params);
    const body = parseInput(approveLimitRequestSchema, request.body ?? {});
    const data = await useCase.execute({
      id,
      userId: request.user!.sub,
      approvedLimitCents: body.approvedLimit === undefined ? undefined : toCents(body.approvedLimit),
      reason: body.reason,
    });
    return reply.send({ data });
  };
}

export function makeRejectCreditLimitRequestController() {
  const useCase = makeRejectCreditLimitRequestUseCase();
  return async function RejectCreditLimitRequestController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(limitRequestParamsSchema, request.params);
    const { reason } = parseInput(rejectLimitRequestSchema, request.body ?? {});
    return reply.send({ data: await useCase.execute({ id, userId: request.user!.sub, reason }) });
  };
}

export function makeListCreditLimitRequestsController() {
  const useCase = makeListCreditLimitRequestsUseCase();
  return async function ListCreditLimitRequestsController(request: FastifyRequest, reply: FastifyReply) {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const filter = parseInput(limitRequestsQuerySchema, request.query);
    return reply.send(await useCase.execute({ page, limit }, filter));
  };
}

export function makeCountCreditLimitRequestsController() {
  const useCase = makeListCreditLimitRequestsUseCase();
  return async function CountCreditLimitRequestsController(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ data: { pending: await useCase.countPending() } });
  };
}
