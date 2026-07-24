// src/modules/customer/infrastructure/http/controllers/ListCustomersController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { makeLisCustomerUseCase } from "../factories/ListCustomerFactory";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListCustomersController() {
  const useCase = makeLisCustomerUseCase();
  return async function ListCustomersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = paginationSchema.parse(request.query);

      // const customers = await useCase.execute(page, limit);
      const customers = await useCase.execute({ page, limit });

      return reply.send(customers);
      // return reply.send(CustomerHttpPresenter.toHTTPList(customers));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
