// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetProductUseCase } from "@catalog/application/factories/GetProductFactory";

export function makeGetProductController() {
  return async function GetProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = request.params as { id: string };
    const useCase = makeGetProductUseCase();
    const product = await useCase.execute(id);
    return reply.send(product);
  };
}
