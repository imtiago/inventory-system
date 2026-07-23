// src/modules/customer/infrastructure/http/controllers/ListCustomersController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeLisCustomerUseCase } from "../factories/ListCustomerFactory";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export function makeListCustomersController() {
  const useCase = makeLisCustomerUseCase();
  return async function ListCustomersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listCustomersQuerySchema.parse(request.query);

      // const customers = await useCase.execute(page, limit);
      const customers = await useCase.execute();

      return reply.send(CustomerHttpPresenter.toHTTPList(customers));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
