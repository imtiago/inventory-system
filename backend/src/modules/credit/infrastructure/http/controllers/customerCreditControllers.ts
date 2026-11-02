import type { FastifyReply, FastifyRequest } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { toCents } from "@shared/domain/money";
import { customerCreditParamsSchema, updateCustomerCreditSchema } from "@credit/interfaces/http/schemas/creditSchemas";
import { makeGetCustomerCreditUseCase, makeUpdateCustomerCreditUseCase } from "@credit/infrastructure/factories/creditFactories";

/** GET /customers/:id/credit — ficha de crédito (customers.read). */
export function makeGetCustomerCreditController() {
  const useCase = makeGetCustomerCreditUseCase();
  return async function GetCustomerCreditController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(customerCreditParamsSchema, request.params);
    return reply.send(HttpResponse.ok(await useCase.execute(id)));
  };
}

/** PUT /customers/:id/credit — ajuste manual de perfil, limite e situação (credit.manage). */
export function makeUpdateCustomerCreditController() {
  const useCase = makeUpdateCustomerCreditUseCase();
  return async function UpdateCustomerCreditController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(customerCreditParamsSchema, request.params);
    const body = parseInput(updateCustomerCreditSchema, request.body);
    const dto = await useCase.execute({
      customerId: id,
      profileCode: body.profileCode,
      limitCents: body.limit === undefined ? undefined : toCents(body.limit),
      status: body.status,
      reason: body.reason,
      userId: request.user?.sub ?? null,
    });
    return reply.send(HttpResponse.ok(dto));
  };
}
