// src/modules/customer/infrastructure/http/controllers/GetCustomerController.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { NotFoundError } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { makeGetCustomerUseCase } from "../factories/GetCustomerByIdFactory";

const paramsSchema = z.object({
  id: z.string().uuid("Identificador inválido."),
});

export function makeGetCustomerController() {
  const useCase = makeGetCustomerUseCase();
  return async function GetCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(paramsSchema, request.params);

    const customer = await useCase.execute(id);
    if (!customer) {
      throw new NotFoundError("Cliente não encontrado.", "CUSTOMER_NOT_FOUND");
    }

    return reply.send(customer);
  };
}
