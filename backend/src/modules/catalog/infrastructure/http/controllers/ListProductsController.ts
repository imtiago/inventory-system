// src/modules/catalog/infrastructure/http/controllers/ListProductsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductsUseCase } from "../factories/ListProductsFactory";

export function makeListProductsController() {
  return async function ListProductsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const useCase = makeListProductsUseCase();
    const products = await useCase.execute(Number(page), Number(limit));
    return reply.send(products);
  };
}
