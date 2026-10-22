import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { createInventorySchema } from "@inventory/interfaces/http/schemas/createInventorySchema";
import { makeGenerateInventoryByProductVariandIdUseCase } from "../factories/GenerateInventoryByProductVariandIdFactory";
import { makeGetInventoryByIdReadUseCase } from "../factories/GetInventoryByIdReadFactory";

export function makeCreateInventoryController() {
  const useCase = makeGenerateInventoryByProductVariandIdUseCase();
  const getInventoryByIdReadUseCase = makeGetInventoryByIdReadUseCase();

  return async function CreateInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { productVariantId } = createInventorySchema.parse(request.body);

      const inventory = await useCase.execute({ productVariantId });
      const dataReturn = await getInventoryByIdReadUseCase.execute(
        inventory.id,
      );

      return reply.send(HttpResponse.created(dataReturn));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
