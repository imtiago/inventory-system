// src/modules/catalog/infrastructure/http/controllers/CreateCategoryController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryRepository } from "../../../domain/repositories/CategoryRepository";
import { CreateCategory } from "../../../application/useCases/CreateCategory";
import { createCategorySchema } from "../../../interfaces/http/schemas/createCategorySchema";

export function makeCreateCategoryController(repository: CategoryRepository) {
  return async function CreateCategoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createCategorySchema.parse(request.body);
      const useCase = new CreateCategory(repository);
      const category = await useCase.execute(data);
      return reply.status(201).send(category);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
