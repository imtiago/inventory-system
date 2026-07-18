// src/modules/catalog/infrastructure/http/controllers/ListBrandsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListBrandsUseCase } from "../factories/ListBrandsFactory";

export function makeListBrandsController() {
  const useCase = makeListBrandsUseCase();
  return async function ListBrandsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const brands = await useCase.execute(Number(page), Number(limit));
    return reply.send(brands);
  };
}
