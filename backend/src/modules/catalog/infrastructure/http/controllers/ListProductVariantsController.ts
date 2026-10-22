// src/modules/catalog/infrastructure/http/controllers/ListProductVariantsController.ts
import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeListProductVariantsUseCase } from "../factories/ListProductVariantsFactory";
import { paginationSchema } from "@shared/interfaces/http/schemas/paginationSchema";

const productIdParamsSchema = z.object({
  productId: z.string().uuid("Identificador inválido."),
});

export function makeListProductVariantsController() {
  const useCase = makeListProductVariantsUseCase();
  return async function ListProductVariantsController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { productId } = parseInput(productIdParamsSchema, request.params);
    const { page, limit } = parseInput(paginationSchema, request.query);

    const variants = await useCase.execute({ productId, page, limit });
    return reply.send(variants);
  };
}
