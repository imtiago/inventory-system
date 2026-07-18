import { FastifyRequest, FastifyReply } from "fastify";
import { makeDeleteProductUseCase } from "../factories/DeleteProductFactory";

export function makeDeleteProductController() {
  return async function DeleteProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };

      const useCase = makeDeleteProductUseCase();
      await useCase.execute(id);

      return reply.status(204).send(); // 204 No Content
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
