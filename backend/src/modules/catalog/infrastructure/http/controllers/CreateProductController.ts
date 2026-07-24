// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";
import { makeCreateProductUseCase } from "../factories/CreateProductFactory";
import { makeGetProductUseCase } from "../factories/GetProductFactory";
import { HttpResponse } from "@shared/http/response";

export function makeCreateProductController() {
  const useCase = makeCreateProductUseCase();
  const useCaseGet = makeGetProductUseCase();

  return async function CreateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createProductSchema.parse(request.body); // usa seu schema existente

      const productCreated = await useCase.execute(data);
      const productRead = await useCaseGet.execute(productCreated.id);

      return reply.status(201).send(HttpResponse.created(productRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
