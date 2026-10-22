// src/modules/customer/infrastructure/http/controllers/CreateCustomerController.ts

import { parseInput } from "@shared/http/parseInput";
import { FastifyReply, FastifyRequest } from "fastify";
import { createCustomerSchema } from "../../../interfaces/http/schemas/createCustomerSchema";
import { makeCreateCustomerUseCase } from "../factories/CreateCustomerFactory";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";

export function makeCreateCustomerController() {
  const useCase = makeCreateCustomerUseCase();
  return async function CreateCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createCustomerSchema, request.body);
    const customer = await useCase.execute(data);

    return reply.status(201).send(CustomerHttpPresenter.toHTTP(customer));
  };
}
