import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { makeRegisterScannedProductFactory } from "../factories/RegisterScannedProductFactory";
import { registerScannedProductSchema } from "@inventory/interfaces/http/schemas/registerScannedProductSchema";

export function makeRegisterScannedProductController() {
  const useCase = makeRegisterScannedProductFactory();

  return async function RegisterScannedProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(registerScannedProductSchema, request.body);
    const result = await useCase.execute({
      barcode: data.barcode,
      boxCode: data.boxCode,
      quantity: data.quantity,
      batchNumber: data.batchNumber,
      expirationDate: data.expirationDate,
      unitCost: data.unitCost,
      userId: request.user?.sub,
    });

    return reply.send(HttpResponse.created(result));
  };
}
