// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { GetProduct } from "../../../application/useCases/GetProduct";

export function makeGetProductController(repository: ProductRepository) {
  return async function GetProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = request.params as { id: string };
    const useCase = new GetProduct(repository);
    const product = await useCase.execute(id);
    return reply.send(product);
  };
}
