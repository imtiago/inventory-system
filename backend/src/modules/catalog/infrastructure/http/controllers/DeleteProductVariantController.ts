import { parseInput } from "@shared/http/parseInput";
import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeDeleteProductVariantUseCase } from "../factories/DeleteProductVariantFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeDeleteProductVariantController() {
  const useCase = makeDeleteProductVariantUseCase();
  return async function DeleteProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);

    await useCase.execute({ productVariantId: id });

    return reply.status(204).send(); // 204 No Content
  };
}
