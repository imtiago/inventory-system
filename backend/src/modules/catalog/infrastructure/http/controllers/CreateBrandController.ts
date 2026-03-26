// src/modules/catalog/infrastructure/http/controllers/CreateBrandController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { BrandRepository } from "../../../domain/repositories/BrandRepository";
import { CreateBrand } from "../../../application/useCases/CreateBrandUseCase";
import { createBrandSchema } from "@catalog/interfaces/http/schemas/createBrandSchema";

export function makeCreateBrandController(repository: BrandRepository) {
  return async function CreateBrandController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createBrandSchema.parse(request.body);
      const useCase = new CreateBrand(repository);
      const brand = await useCase.execute(data);
      return reply.status(201).send(brand);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
