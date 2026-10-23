import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { createCustomerBodySchema } from "@customer/interfaces/http/schemas/customerSchemas";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";
import { makeCreateCustomerUseCase } from "../factories/CreateCustomerFactory";

export function makeCreateCustomerController() {
  const useCase = makeCreateCustomerUseCase();
  return async function CreateCustomerController(request: FastifyRequest, reply: FastifyReply) {
    const data = parseInput(createCustomerBodySchema, request.body);
    const customer = await useCase.execute(data);

    return reply.status(201).send(HttpResponse.created(CustomerHttpPresenter.toHTTP(customer)));
  };
}
