// src/modules/catalog/infrastructure/http/controllers/CreateCategoryController.ts
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { createCategorySchema } from "../../../interfaces/http/schemas/createCategorySchema";
import { makeCreateCategoryUseCase } from "../factories/CreateCategoryFactory";

export function makeCreateCategoryController() {
  const useCase = makeCreateCategoryUseCase();

  return async function CreateCategoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createCategorySchema, request.body);
    const category = await useCase.execute({
      name: data.name,
    });
    return reply.status(201).send(category);
  };
}
