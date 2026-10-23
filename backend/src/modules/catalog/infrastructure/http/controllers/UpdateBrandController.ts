import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import {
  brandCategoryBodySchema,
  brandCategoryIdParamsSchema,
} from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeUpdateBrandUseCase } from "../factories/UpdateBrandFactory";

export function makeUpdateBrandController() {
  const useCase = makeUpdateBrandUseCase();
  return async function UpdateBrandController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    const { name } = parseInput(brandCategoryBodySchema, request.body);
    const brand = await useCase.execute({ id, name });
    return reply.send(HttpResponse.ok(brand));
  };
}
