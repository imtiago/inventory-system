import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import {
  brandCategoryBodySchema,
  brandCategoryIdParamsSchema,
} from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeUpdateCategoryUseCase } from "../factories/UpdateCategoryFactory";

export function makeUpdateCategoryController() {
  const useCase = makeUpdateCategoryUseCase();
  return async function UpdateCategoryController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    const { name } = parseInput(brandCategoryBodySchema, request.body);
    const category = await useCase.execute({ id, name });
    return reply.send(HttpResponse.ok(category));
  };
}
