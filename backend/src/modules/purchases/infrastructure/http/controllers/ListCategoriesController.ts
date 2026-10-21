// src/modules/catalog/infrastructure/http/controllers/ListCategoriesController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetCategoriesUseCase } from "../factories/GetCategoriesFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListCategoriesController() {
  const useCase = makeGetCategoriesUseCase();
  return async function ListCategoriesController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = paginationSchema.parse(request.query);

    // const categories = await useCase.execute(Number(page), Number(limit));
    const categories = await useCase.execute({ page, limit });
    return reply.send(categories);
  };
}
