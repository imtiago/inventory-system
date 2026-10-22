import { z } from "zod";
import { parseInput } from "@shared/http/parseInput";
import { NotFoundError } from "@shared/domain/errors";
import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetProductVariantByBarcodeUseCase } from "../factories/GetProductVariantByBarcodeFactory";

const barcodeParamsSchema = z.object({
  id: z.string().trim().min(1, "Código de barras inválido."),
});

export function makeGetProductVariantByBarcodeController() {
  const useCase = makeGetProductVariantByBarcodeUseCase();
  return async function GetProductVariantByBarcodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { id } = parseInput(barcodeParamsSchema, request.params);
    const productVariant = await useCase.execute(id);
    if (!productVariant) {
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }
    return reply.send(HttpResponse.ok(productVariant));
  };
}
