import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { productIdParamsSchema } from "@catalog/interfaces/http/schemas/productSchemas";
import { makeGetProductByIdUseCase } from "../factories/GetProductByIdFactory";

export function makeGetProductController() {
  const useCase = makeGetProductByIdUseCase();
  return async function GetProductController(request: FastifyRequest, reply: FastifyReply) {
    const { id } = parseInput(productIdParamsSchema, request.params);
    const product = await useCase.execute(id);
    return reply.send(HttpResponse.ok(product));
  };
}
