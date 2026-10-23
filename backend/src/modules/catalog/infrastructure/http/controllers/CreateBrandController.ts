import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { brandCategoryBodySchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeCreateBrandUseCase } from "../factories/CreateBrandFactory";

export function makeCreateBrandController() {
  const useCase = makeCreateBrandUseCase();
  return async function CreateBrandController(request: FastifyRequest, reply: FastifyReply) {
    const { name } = parseInput(brandCategoryBodySchema, request.body);
    const brand = await useCase.execute({ name });
    return reply.status(201).send(HttpResponse.created(brand));
  };
}
