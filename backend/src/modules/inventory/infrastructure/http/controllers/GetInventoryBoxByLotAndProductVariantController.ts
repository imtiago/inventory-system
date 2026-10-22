import { FastifyRequest, FastifyReply } from "fastify";
import { parseInput } from "@shared/http/parseInput";
import { HttpResponse } from "@shared/http/response";
import { getInventoryBoxByLotAndProductVariantSchema } from "@inventory/interfaces/http/schemas/getInventoryBoxByLotAndProductVariantSchema";
import { makeGetInventoryBoxByLotAndProductVariantIdUseCase } from "../factories/GetInventoryBoxByLotAndProductVariantIdFactory";

export function makeGetInventoryBoxByLotAndProductVariantController() {
  const useCase = makeGetInventoryBoxByLotAndProductVariantIdUseCase();
  return async function GetInventoryBoxByLotAndProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { batchNumber, productVariantId } =
      parseInput(getInventoryBoxByLotAndProductVariantSchema, request.query);
    const boxs = await useCase.execute({ batchNumber, productVariantId });

    return reply.send(HttpResponse.paginated(boxs));
  };
}
