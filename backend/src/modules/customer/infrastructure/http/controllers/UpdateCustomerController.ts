import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  customerIdParamsSchema,
  updateCustomerBodySchema,
} from "@customer/interfaces/http/schemas/customerSchemas";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";
import { makeUpdateCustomerUseCase } from "../factories/UpdateCustomerFactory";

export function makeUpdateCustomerController() {
  const useCase = makeUpdateCustomerUseCase();
  return async function UpdateCustomerController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(customerIdParamsSchema, request.params);
    const patch = parseInput(updateCustomerBodySchema, request.body);

    const customer = await useCase.execute({ id, ...patch });

    return reply.send(HttpResponse.ok(CustomerHttpPresenter.toHTTP(customer)));
  };
}
