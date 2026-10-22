import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeUpdateCustomerUseCase } from "../factories/UpdateCustomerFactory";
import { createCustomerSchema } from "@customer/interfaces/http/schemas/createCustomerSchema";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeUpdateCustomerController() {
  const useCase = makeUpdateCustomerUseCase();
  return async function UpdateCustomerController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);
    const data = parseInput(createCustomerSchema, request.body);

    const updatedProduct = await useCase.execute({ id, ...data });

    return reply
      .status(200)
      .send(CustomerHttpPresenter.toHTTP(updatedProduct));
  };
}
