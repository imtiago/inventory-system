import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
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
    const { productVariantId } = parseInput(createInventorySchema, request.body);

    const inventory = await useCase.execute({ productVariantId });
    const dataReturn = await getInventoryByIdReadUseCase.execute(
      inventory.id,
    );

    return reply.send(HttpResponse.created(dataReturn));
  };
}
