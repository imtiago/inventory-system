// src/modules/customer/infrastructure/http/controllers/CreateCustomerController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { CustomerRepository } from "../../../domain/repositories/CustomerRepository";
import { CreateCustomer } from "../../../application/useCases/CreateCustomer";
import { createCustomerSchema } from "../../../interfaces/http/schemas/createCustomerSchema";

export function makeCreateCustomerController(repository: CustomerRepository) {
  return async function CreateCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createCustomerSchema.parse(request.body);

      const useCase = new CreateCustomer(repository);
      const customer = await useCase.execute(data);

      return reply.status(201).send(customer);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
