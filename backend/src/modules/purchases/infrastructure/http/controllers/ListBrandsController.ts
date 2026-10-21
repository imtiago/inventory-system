// src/modules/catalog/infrastructure/http/controllers/ListBrandsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListBrandsUseCase } from "../factories/ListBrandsFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListBrandsController() {
  const useCase = makeListBrandsUseCase();
  return async function ListBrandsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = paginationSchema.parse(request.query);

    const brands = await useCase.execute({ page, limit });

    return reply.send(brands);
  };
}
