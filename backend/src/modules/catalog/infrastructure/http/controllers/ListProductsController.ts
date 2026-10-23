import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { listProductsSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeListProductsUseCase } from "../factories/ListProductsFactory";

export function makeListProductsController() {
  const useCase = makeListProductsUseCase();
  return async function ListProductsController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listProductsSchema, request.query);
    const result = await useCase.execute(query);
    return reply.send(HttpResponse.paginated(result));
  };
}
