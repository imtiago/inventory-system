import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import {
  productIdParamsSchema,
  updateProductSchema,
} from "@catalog/interfaces/http/schemas/productSchemas";
import { makeUpdateProductUseCase } from "../factories/UpdateProductFactory";

export function makeUpdateProductController() {
  const useCase = makeUpdateProductUseCase();
  return async function UpdateProductController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(productIdParamsSchema, request.params);
    const data = parseInput(updateProductSchema, request.body);

    const product = await useCase.execute({ ...data, id });

    return reply.send(HttpResponse.ok(product));
  };
}
