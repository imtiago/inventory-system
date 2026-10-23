import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { brandCategoryIdParamsSchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeDeleteCategoryUseCase } from "../factories/DeleteCategoryFactory";

export function makeDeleteCategoryController() {
  const useCase = makeDeleteCategoryUseCase();
  return async function DeleteCategoryController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    await useCase.execute({ id });
    return reply.status(204).send();
  };
}
