// src/modules/catalog/infrastructure/http/controllers/ListCategoriesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaCategoryRepository } from "../../repositories/PrismaCategoryRepository";
import { GetCategories } from "@catalog/application/useCases/GetCategories";

export function makeListCategoriesController(
  repository: PrismaCategoryRepository,
) {
  return async function ListCategoriesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const useCase = new GetCategories(repository);
    const categories = await useCase.execute(Number(page), Number(limit));
    return reply.send(categories);
  };
}
