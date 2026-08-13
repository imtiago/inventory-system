import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
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
        batchNumber: data.batchNumber,
        expirationDate: data.expirationDate
          ? new Date(data.expirationDate)
          : undefined,
        quantity: data.quantity,
      });

      return reply.send(HttpResponse.created(result));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
