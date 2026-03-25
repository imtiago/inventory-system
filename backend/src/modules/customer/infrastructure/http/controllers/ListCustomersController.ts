// src/modules/customer/infrastructure/http/controllers/ListCustomersController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { CustomerRepository } from "../../../domain/repositories/CustomerRepository";
import { ListCustomers } from "../../../application/useCases/ListCustomers";
import { z } from "zod";

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
});

export function makeListCustomersController(repository: CustomerRepository) {
  return async function ListCustomersController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { page, limit } = listCustomersQuerySchema.parse(request.query);

      const useCase = new ListCustomers(repository);
      const customers = await useCase.execute(page, limit);

      return reply.send(customers);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
