// src/modules/catalog/infrastructure/http/controllers/ListProductsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { ListProducts } from "../../../application/useCases/ListProducts";

export function makeListProductsController(repository: ProductRepository) {
  return async function ListProductsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { page = 1, limit = 10 } = request.query as any;
    const useCase = new ListProducts(repository);
    const products = await useCase.execute(Number(page), Number(limit));
    return reply.send(products);
  };
}
