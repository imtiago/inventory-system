// src/modules/catalog/infrastructure/http/controllers/GetProductController.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetProductVariantByIdUseCase } from "../factories/GetProductVariantByIdFactory";

export function makeGetProductVariantController() {
  const useCase = makeGetProductVariantByIdUseCase();
  return async function GetProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = request.params as { id: string };
    const productVariant = await useCase.execute(id);
    return reply.send(HttpResponse.ok(productVariant));
  };
}
