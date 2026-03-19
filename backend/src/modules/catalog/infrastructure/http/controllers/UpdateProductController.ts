// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { UpdateProductUseCase } from "@catalog/application/useCases/UpdateProduct";
import { updateProductSchema } from "@catalog/interfaces/http/schemas/productSchemas";

export function makeUpdateProductController(repository: ProductRepository) {
  return async function UpdateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };
      const data = updateProductSchema.parse(request.body);

      const useCase = new UpdateProductUseCase(repository);
      const updatedProduct = await useCase.execute(id, data);

      return reply.status(200).send(updatedProduct);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
