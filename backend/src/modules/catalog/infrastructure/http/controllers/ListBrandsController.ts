// src/modules/catalog/infrastructure/http/controllers/ListBrandsController.ts
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListBrandsUseCase } from "../factories/ListBrandsFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListBrandsController() {
  const useCase = makeListBrandsUseCase();
  return async function ListBrandsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page, limit } = parseInput(paginationSchema, request.query);

    const brands = await useCase.execute({ page, limit });

    return reply.send(brands);
  };
}
