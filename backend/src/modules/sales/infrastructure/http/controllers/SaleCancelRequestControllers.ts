import { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";
import {
  cancelReasonBodySchema,
  cancelRequestsQuerySchema,
  requestIdParamsSchema,
  saleIdParamsSchema,
} from "@sales/interfaces/http/schemas/saleCancelRequestSchemas";
import {
  makeApproveSaleCancelRequestUseCase,
  makeListSaleCancelRequestsUseCase,
  makeRejectSaleCancelRequestUseCase,
  makeRequestSaleCancelUseCase,
} from "../factories/SaleCancelRequestFactory";

export function makeRequestSaleCancelController() {
  const useCase = makeRequestSaleCancelUseCase();
  return async function RequestSaleCancelController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(saleIdParamsSchema, request.params);
    const { reason } = parseInput(cancelReasonBodySchema, request.body ?? {});
    const data = await useCase.execute({ saleId: id, reason, userId: request.user!.sub });
    return reply.status(201).send({ data });
  };
}

export function makeApproveSaleCancelRequestController() {
  const useCase = makeApproveSaleCancelRequestUseCase();
  return async function ApproveSaleCancelRequestController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(requestIdParamsSchema, request.params);
    return reply.send({ data: await useCase.execute({ id, userId: request.user!.sub }) });
  };
}

export function makeRejectSaleCancelRequestController() {
  const useCase = makeRejectSaleCancelRequestUseCase();
  return async function RejectSaleCancelRequestController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(requestIdParamsSchema, request.params);
    const { reason } = parseInput(cancelReasonBodySchema, request.body ?? {});
    return reply.send({ data: await useCase.execute({ id, userId: request.user!.sub, reason }) });
  };
}

export function makeListSaleCancelRequestsController() {
  const useCase = makeListSaleCancelRequestsUseCase();
  return async function ListSaleCancelRequestsController(request: FastifyRequest, reply: FastifyReply) {
    const { page, limit } = parseInput(paginationSchema, request.query);
    const filter = parseInput(cancelRequestsQuerySchema, request.query);
    return reply.send(await useCase.execute({ page, limit }, filter));
  };
}

export function makeCountSaleCancelRequestsController() {
  const useCase = makeListSaleCancelRequestsUseCase();
  return async function CountSaleCancelRequestsController(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ data: { pending: await useCase.countPending() } });
  };
}
