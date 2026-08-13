import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { getInventoryBoxByLotAndProductVariantSchema } from "@inventory/interfaces/http/schemas/getInventoryBoxByLotAndProductVariantSchema";
import { makeGetInventoryBoxByLotAndProductVariantIdUseCase } from "../factories/GetInventoryBoxByLotAndProductVariantIdFactory";

export function makeGetInventoryBoxByLotAndProductVariantController() {
  const useCase = makeGetInventoryBoxByLotAndProductVariantIdUseCase();
  return async function GetInventoryBoxByLotAndProductVariantController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { batchNumber, productVariantId } =
        getInventoryBoxByLotAndProductVariantSchema.parse(request.query);
      const box = await useCase.execute({ batchNumber, productVariantId });
      if (!box) {
        return reply.status(404).send({ message: "InventoryBox not found" });
      }

      return reply.send(HttpResponse.ok(box));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
