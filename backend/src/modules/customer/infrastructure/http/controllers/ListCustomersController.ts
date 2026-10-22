// src/modules/customer/infrastructure/http/controllers/ListCustomersController.ts

import { parseInput } from "@shared/http/parseInput";
import { FastifyReply, FastifyRequest } from "fastify";
import { makeLisCustomerUseCase } from "../factories/ListCustomerFactory";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";
import { listCustomersSchema } from "@customer/interfaces/http/schemas/listCustomersSchema";

export function makeListCustomersController() {
  const useCase = makeLisCustomerUseCase();
  return async function ListCustomersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit, search } = parseInput(listCustomersSchema, request.query);

    // const customers = await useCase.execute(page, limit);
    const customers = await useCase.execute({ page, limit, search });

    return reply.send(customers);
    // return reply.send(CustomerHttpPresenter.toHTTPList(customers));
  };
}
