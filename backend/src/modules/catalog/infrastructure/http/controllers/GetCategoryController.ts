import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { brandCategoryIdParamsSchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeGetCategoryByIdUseCase } from "../factories/GetCategoryByIdFactory";

export function makeGetCategoryController() {
  const useCase = makeGetCategoryByIdUseCase();
  return async function GetCategoryController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    const category = await useCase.execute(id);
    return reply.send(HttpResponse.ok(category));
  };
}
