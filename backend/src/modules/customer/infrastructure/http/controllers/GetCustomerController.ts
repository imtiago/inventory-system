// src/modules/customer/infrastructure/http/controllers/GetCustomerController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeGetCustomerUseCase } from "../factories/GetCustomerFactory";

const paramsSchema = z.object({
  id: z.string().uuid().or(z.string()), // ajuste se quiser validar UUID
});

export function makeGetCustomerController() {
  return async function GetCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = paramsSchema.parse(request.params);

      const useCase = makeGetCustomerUseCase();
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
