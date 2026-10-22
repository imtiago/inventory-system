import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { makeRegisterScannedProductFactory } from "../factories/RegisterScannedProductFactory";
import { registerScannedProductSchema } from "@inventory/interfaces/http/schemas/registerScannedProductSchema";

export function makeRegisterScannedProductController() {
  const useCase = makeRegisterScannedProductFactory();

  return async function RegisterScannedProductController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = registerScannedProductSchema.parse(request.body);
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
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
