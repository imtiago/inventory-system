import { parseInput } from "@shared/http/parseInput";
import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeDeleteProductUseCase } from "../factories/DeleteProductFactory";

const idParamsSchema = z.object({ id: z.string().uuid("Identificador inválido.") });

export function makeDeleteProductController() {
  const useCase = makeDeleteProductUseCase();
  return async function DeleteProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(idParamsSchema, request.params);

    await useCase.execute({ id });

    return reply.status(204).send(); // 204 No Content
  };
}
