// src/modules/catalog/infrastructure/http/controllers/ListCategoriesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetCategoriesUseCase } from "../factories/GetCategoriesFactory";

export function makeListCategoriesController() {
  return async function ListCategoriesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const useCase = makeGetCategoriesUseCase();
    // const categories = await useCase.execute(Number(page), Number(limit));
    const categories = await useCase.execute();
    return reply.send(categories);
  };
}
