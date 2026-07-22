// src/modules/catalog/infrastructure/http/controllers/ListBrandsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListBrandsUseCase } from "../factories/ListBrandsFactory";

export function makeListBrandsController() {
  return async function ListBrandsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const useCase = makeListBrandsUseCase();
    const { page = 1, limit = 10 } = request.query as any;
    // const brands = await useCase.execute(Number(page), Number(limit));
    const brands = await useCase.execute();
    return reply.send(brands);
  };
}
