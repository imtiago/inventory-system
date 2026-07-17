// src/modules/catalog/infrastructure/http/controllers/ListBrandsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ListBrandsUseCase } from "@catalog/application/useCases/ListBrandsUseCase";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

export function makeListBrandsController(repository: BrandRepository) {
  return async function ListBrandsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const useCase = new ListBrandsUseCase(repository);
    const brands = await useCase.execute(Number(page), Number(limit));
    return reply.send(brands);
  };
}
