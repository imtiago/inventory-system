import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { createProductSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeCreateProductUseCase } from "../factories/CreateProductFactory";

export function makeCreateProductController() {
  const useCase = makeCreateProductUseCase();

  return async function CreateProductController(request: FastifyRequest, reply: FastifyReply) {
    const { salePrice, ...data } = parseInput(createProductSchema, request.body);
    const product = await useCase.execute({
      ...data,
      ...(salePrice !== undefined ? { variant: { name: "Padrão", salePrice } } : {}),
    });
    return reply.status(201).send(HttpResponse.created(product));
  };
}
