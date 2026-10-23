import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { brandCategoryIdParamsSchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeGetBrandByIdUseCase } from "../factories/GetBrandByIdFactory";

export function makeGetBrandController() {
  const useCase = makeGetBrandByIdUseCase();
  return async function GetBrandController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(brandCategoryIdParamsSchema, request.params);
    const brand = await useCase.execute(id);
    return reply.send(HttpResponse.ok(brand));
  };
}
