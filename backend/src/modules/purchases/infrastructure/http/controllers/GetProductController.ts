// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetProductUseCase } from "../factories/GetProductFactory";

export function makeGetProductController() {
  const useCase = makeGetProductUseCase();
  return async function GetProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = request.params as { id: string };
    const product = await useCase.execute(id);
    return reply.send(product);
  };
}
