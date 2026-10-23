import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { listBrandCategorySchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeListBrandsUseCase } from "../factories/ListBrandsFactory";

export function makeListBrandsController() {
  const useCase = makeListBrandsUseCase();
  return async function ListBrandsController(request: FastifyRequest, reply: FastifyReply) {
    const query = parseInput(listBrandCategorySchema, request.query);
    const result = await useCase.execute(query);
    return reply.send(HttpResponse.paginated(result));
  };
}
