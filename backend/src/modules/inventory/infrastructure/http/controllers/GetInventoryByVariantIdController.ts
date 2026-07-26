import { getInventorySchema } from "@inventory/interfaces/http/schemas/getInventorySchema";
import { FastifyRequest, FastifyReply } from "fastify";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { HttpResponse } from "@shared/http/response";

export function makeGetInventoryByVariantIdController() {
  const useCase = makeGetInventoryByVariantId();
  return async function GetInventoryByVariantIdController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { variantId } = getInventorySchema.parse(request.params);

      const inventory = await useCase.execute(variantId);

      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      return reply.send(HttpResponse.ok(inventory));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
