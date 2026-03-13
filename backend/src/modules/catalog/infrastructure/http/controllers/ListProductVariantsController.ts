// src/modules/catalog/infrastructure/http/controllers/ListProductVariantsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { ListProductVariants } from "../../../application/useCases/ListProductVariants";

export function makeListProductVariantsController(
  repository: ProductRepository,
) {
  return async function ListProductVariantsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { productId } = request.params as { productId: string };
    const useCase = new ListProductVariants(repository);
    const variants = await useCase.execute(productId);
    return reply.send(variants);
  };
}
