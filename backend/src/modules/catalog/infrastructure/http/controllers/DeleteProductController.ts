import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { productIdParamsSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeDeleteProductUseCase } from "../factories/DeleteProductFactory";

export function makeDeleteProductController() {
  const useCase = makeDeleteProductUseCase();
  return async function DeleteProductController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(productIdParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}
