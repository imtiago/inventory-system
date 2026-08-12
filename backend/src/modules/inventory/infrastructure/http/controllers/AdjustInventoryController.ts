import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { makeAdjustInventoryFactory } from "../factories/AdjustInventoryFactory";
import { adjustInventorySchema } from "@inventory/interfaces/http/schemas/adjustInventorySchema";
export function makeAdjustInventoryController() {
  const useCase = makeAdjustInventoryFactory();
  const getInventoryByVariantId = makeGetInventoryByVariantId();

  return async function AdjustInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = adjustInventorySchema.parse(request.body);
      const moviment = await useCase.execute({
        productVariantId: data.productVariantId,
        origin: data.origin,
        quantity: data.quantity,
        userId: data.userId,
        notes: data.notes,
      });

      const movimentRead = await getInventoryByVariantId.execute(
        moviment.productVariantId,
      );

      return reply.send(HttpResponse.created(movimentRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
