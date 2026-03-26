// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";
import { makeCreateProductUseCase } from "@catalog/application/factories/CreateProductFactory";

export function makeCreateProductController() {
  return async function CreateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createProductSchema.parse(request.body); // usa seu schema existente

      const useCase = makeCreateProductUseCase();

      const product = await useCase.execute(data);
      return reply.status(201).send(product);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
