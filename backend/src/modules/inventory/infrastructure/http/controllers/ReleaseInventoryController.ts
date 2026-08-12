import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { makeReleaseInventoryFactory } from "../factories/ReleaseInventoryFactory";
import { releaseInventorySchema } from "@inventory/interfaces/http/schemas/releaseInventorySchema";
export function makeReleaseInventoryController() {
  const useCase = makeReleaseInventoryFactory();
  const getInventoryByVariantId = makeGetInventoryByVariantId();

  return async function ReleaseInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = releaseInventorySchema.parse(request.body);
      const moviment = await useCase.execute({
        inventoryId: data.inventoryId,

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
