import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetProductVariantByBarcodeUseCase } from "../factories/GetProductVariantByBarcodeFactory";

export function makeGetProductVariantByBarcodeController() {
  const useCase = makeGetProductVariantByBarcodeUseCase();
  return async function GetProductVariantByBarcodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = request.params as { id: string };
    const productVariant = await useCase.execute(id);
    if (!productVariant) {
      return reply.status(404).send(HttpResponse.notFound());
    }
    return reply.send(HttpResponse.ok(productVariant));
  };
}
