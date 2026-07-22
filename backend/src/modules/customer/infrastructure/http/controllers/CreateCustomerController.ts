// src/modules/customer/infrastructure/http/controllers/CreateCustomerController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { createCustomerSchema } from "../../../interfaces/http/schemas/createCustomerSchema";
import { makeCreateCustomerUseCase } from "../factories/CreateCustomerFactory";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";

export function makeCreateCustomerController() {
  return async function CreateCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createCustomerSchema.parse(request.body);

      const useCase = makeCreateCustomerUseCase();
      const customer = await useCase.execute(data);

      return reply.status(201).send(CustomerHttpPresenter.toHTTP(customer));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
