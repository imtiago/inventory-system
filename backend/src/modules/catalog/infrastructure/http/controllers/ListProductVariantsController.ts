// src/modules/catalog/infrastructure/http/controllers/ListProductVariantsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductVariantsUseCase } from "../factories/ListProductVariantsFactory";

export function makeListProductVariantsController() {
  return async function ListProductVariantsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { productId } = request.params as { productId: string };
    const useCase = makeListProductVariantsUseCase();
    const variants = await useCase.execute(productId);
    return reply.send(variants);
  };
}
