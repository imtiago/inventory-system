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
      const boxs = await useCase.execute({ batchNumber, productVariantId });

      return reply.send(HttpResponse.paginated(boxs));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
