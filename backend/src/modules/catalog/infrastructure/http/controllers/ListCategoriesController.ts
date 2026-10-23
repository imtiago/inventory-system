import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { listBrandCategorySchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeListCategoriesUseCase } from "../factories/ListCategoriesFactory";

export function makeListCategoriesController() {
  const useCase = makeListCategoriesUseCase();
  return async function ListCategoriesController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listBrandCategorySchema, request.query);
    const result = await useCase.execute(query);
    return reply.send(HttpResponse.paginated(result));
  };
}
