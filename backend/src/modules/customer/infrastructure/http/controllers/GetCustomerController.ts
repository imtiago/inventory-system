// src/modules/customer/infrastructure/http/controllers/GetCustomerController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { CustomerRepository } from "../../../domain/repositories/CustomerRepository";
import { GetCustomer } from "../../../application/useCases/GetCustomer";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid().or(z.string()), // ajuste se quiser validar UUID
});

export function makeGetCustomerController(repository: CustomerRepository) {
  return async function GetCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = paramsSchema.parse(request.params);

      const useCase = new GetCustomer(repository);
      const customer = await useCase.execute(id);

      return reply.send(customer);
    } catch (err: any) {
      if (err.message === "Cliente não encontrado") {
        return reply.status(404).send({ message: err.message });
      }

      return reply.status(400).send({ message: err.message });
    }
  };
}
