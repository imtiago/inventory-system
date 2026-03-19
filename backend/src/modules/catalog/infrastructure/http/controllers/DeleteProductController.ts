import { DeleteProductUseCase } from "@catalog/application/useCases/DeleteProductUseCase";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { FastifyRequest, FastifyReply } from "fastify";

export function makeDeleteProductController(repository: ProductRepository) {
  return async function DeleteProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };

      const useCase = new DeleteProductUseCase(repository);
      await useCase.execute(id);

      return reply.status(204).send(); // 204 No Content
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
