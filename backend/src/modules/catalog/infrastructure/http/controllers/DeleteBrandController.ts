import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { brandCategoryIdParamsSchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeDeleteBrandUseCase } from "../factories/DeleteBrandFactory";

export function makeDeleteBrandController() {
  const useCase = makeDeleteBrandUseCase();
  return async function DeleteBrandController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}
