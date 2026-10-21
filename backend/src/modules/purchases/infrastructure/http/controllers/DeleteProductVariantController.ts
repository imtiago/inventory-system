import { FastifyRequest, FastifyReply } from "fastify";
import { makeDeleteProductVariantUseCase } from "../factories/DeleteProductVariantFactory";

export function makeDeleteProductVariantController() {
  const useCase = makeDeleteProductVariantUseCase();
  return async function DeleteProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { id } = request.params as { id: string };
      console.log("object");

      await useCase.execute({ productVariantId: id });

      return reply.status(204).send(); // 204 No Content
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
