import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { getInventoryByProductVariantBarcodeSchema } from "@inventory/interfaces/http/schemas/getInventoryByProductVariantBarcodeSchema";
import { makeGetInventoryByProductVariantBarcode } from "../factories/GetInventoryByProductVariantBarcodeFactory";

export function makeGetInventoryByProductVariantBarcodeController() {
  const useCase = makeGetInventoryByProductVariantBarcode();
  return async function GetInventoryByProductVariantBarcodeController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { barcode } = getInventoryByProductVariantBarcodeSchema.parse(
        request.params,
      );

      const data = await useCase.execute(barcode);

      if (!data) {
        return reply.status(404).send({ message: "ProductVariant not found" });
      }

      return reply.send(HttpResponse.ok(data));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
