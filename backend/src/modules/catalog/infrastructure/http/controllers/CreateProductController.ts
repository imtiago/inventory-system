// src/modules/catalog/infrastructure/http/controllers/CreateProductController.ts
import { parseInput } from "@shared/http/parseInput";
import { FastifyRequest, FastifyReply } from "fastify";
import { createProductSchema } from "../../../interfaces/http/schemas/createProductSchema";
import { makeCreateProductUseCase } from "../factories/CreateProductFactory";
import { HttpResponse } from "@shared/http/response";
import { makeGetProductByIdUseCase } from "../factories/GetProductByIdFactory";

export function makeCreateProductController() {
  const useCase = makeCreateProductUseCase();
  const useCaseGet = makeGetProductByIdUseCase();

  return async function CreateProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(createProductSchema, request.body); // usa seu schema existente

    const productCreated = await useCase.execute(data);
    const productRead = await useCaseGet.execute(productCreated.id);

    return reply.status(201).send(HttpResponse.created(productRead));
  };
}
