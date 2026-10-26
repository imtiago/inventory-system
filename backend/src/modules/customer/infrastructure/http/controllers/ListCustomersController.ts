import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { FastifyReply, FastifyRequest } from "fastify";
import { listCustomersSchema } from "@customer/interfaces/http/schemas/customerSchemas";
import { makeListCustomerUseCase } from "../factories/ListCustomerFactory";

export function makeListCustomersController() {
  const useCase = makeListCustomerUseCase();
  return async function ListCustomersController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listCustomersSchema, request.query);
    const result = await useCase.execute(query);

    return reply.send(HttpResponse.paginated(result));
  };
}
