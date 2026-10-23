import { FastifyReply, FastifyRequest } from "fastify";
import { NotFoundError } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { customerIdParamsSchema } from "@customer/interfaces/http/schemas/customerSchemas";
import { CustomerHttpPresenter } from "@customer/interfaces/http/presenters/CustomerHttpPresenter";
import { makeGetCustomerUseCase } from "../factories/GetCustomerByIdFactory";

export function makeGetCustomerController() {
  const useCase = makeGetCustomerUseCase();
  return async function GetCustomerController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(customerIdParamsSchema, request.params);

    const customer = await useCase.execute(id);
    if (!customer) {
      throw new NotFoundError("Cliente não encontrado.", "CUSTOMER_NOT_FOUND");
    }

    return reply.send(HttpResponse.ok(CustomerHttpPresenter.toHTTP(customer)));
  };
}
