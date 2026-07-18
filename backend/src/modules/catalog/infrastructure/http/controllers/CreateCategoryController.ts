// src/modules/catalog/infrastructure/http/controllers/CreateCategoryController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createCategorySchema } from "../../../interfaces/http/schemas/createCategorySchema";
import { makeCreateCategoryUseCase } from "../factories/CreateCategoryFactory";

export function makeCreateCategoryController() {
  const useCase = makeCreateCategoryUseCase();

  return async function CreateCategoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createCategorySchema.parse(request.body);
      const category = await useCase.execute(data.name);
      return reply.status(201).send(category);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
