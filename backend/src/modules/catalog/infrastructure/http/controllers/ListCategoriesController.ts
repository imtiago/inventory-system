// src/modules/catalog/infrastructure/http/controllers/ListCategoriesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetCategoriesUseCase } from "../factories/GetCategoriesFactory";

export function makeListCategoriesController() {
  const useCase = makeGetCategoriesUseCase();
  return async function ListCategoriesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const categories = await useCase.execute(Number(page), Number(limit));
    return reply.send(categories);
  };
}
