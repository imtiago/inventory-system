import { NotFoundError } from "@shared/domain/errors";
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
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }
    return reply.send(HttpResponse.ok(productVariant));
  };
}
