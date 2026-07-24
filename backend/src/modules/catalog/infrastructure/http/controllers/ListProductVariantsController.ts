// src/modules/catalog/infrastructure/http/controllers/ListProductVariantsController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductVariantsUseCase } from "../factories/ListProductVariantsFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

export function makeListProductVariantsController() {
  const useCase = makeListProductVariantsUseCase();
  return async function ListProductVariantsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { productId } = request.params as { productId: string };
    const { page, limit } = paginationSchema.parse(request.query);

    const variants = await useCase.execute({ productId, page, limit });
    return reply.send(variants);
  };
}
