// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { CreateProduct } from "../../../application/useCases/CreateProduct";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";

export function makeCreateProductController(repository: ProductRepository) {
  return async function CreateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createProductSchema.parse(request.body); // usa seu schema existente
      const useCase = new CreateProduct(repository);
      const product = await useCase.execute(data);
      return reply.status(201).send(product);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
