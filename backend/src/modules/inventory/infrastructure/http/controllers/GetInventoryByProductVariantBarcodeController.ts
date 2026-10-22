import { FastifyRequest, FastifyReply } from "fastify";
import { NotFoundError, ErrorCodes } from "@shared/domain/errors";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { getInventoryByProductVariantBarcodeSchema } from "@inventory/interfaces/http/schemas/getInventoryByProductVariantBarcodeSchema";
import { makeGetInventoryByProductVariantBarcode } from "../factories/GetInventoryByProductVariantBarcodeFactory";

export function makeGetInventoryByProductVariantBarcodeController() {
  const useCase = makeGetInventoryByProductVariantBarcode();
  return async function GetInventoryByProductVariantBarcodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { barcode } = parseInput(getInventoryByProductVariantBarcodeSchema, request.params);

    const data = await useCase.execute(barcode);

    if (!data) {
      throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
    }

    return reply.send(HttpResponse.ok(data));
  };
}
