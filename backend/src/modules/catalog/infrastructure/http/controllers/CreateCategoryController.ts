import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { brandCategoryBodySchema } from "@catalog/interfaces/http/schemas/brandCategorySchemas";
import { makeCreateCategoryUseCase } from "../factories/CreateCategoryFactory";

export function makeCreateCategoryController() {
  const useCase = makeCreateCategoryUseCase();
  return async function CreateCategoryController(request: FastifyRequest, reply: FastifyReply) {
    const { name } = parseInput(brandCategoryBodySchema, request.body);
    const category = await useCase.execute({ name });
    return reply.status(201).send(HttpResponse.created(category));
  };
}
