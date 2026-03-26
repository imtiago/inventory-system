// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { updateProductSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeUpdateProductUseCase } from "@catalog/application/factories/UpdateProductFactory";

export function makeUpdateProductController() {
  return async function UpdateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };
      const data = updateProductSchema.parse(request.body);

      const useCase = makeUpdateProductUseCase();
      const updatedProduct = await useCase.execute(id, data);

      return reply.status(200).send(updatedProduct);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
