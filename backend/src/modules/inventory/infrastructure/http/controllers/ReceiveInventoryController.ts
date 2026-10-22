import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { receiveInventorySchema } from "@inventory/interfaces/http/schemas/receiveInventorySchema";
import { makeGetInventoryByIdUseCase } from "../factories/GetInventoryByIdFactory";

export function makeReceiveInventoryController() {
  const useCase = makeReceiveInventory();
  const getInventoryById = makeGetInventoryByIdUseCase();

  return async function ReceiveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(receiveInventorySchema, request.body);

    const { inventory } = await useCase.execute({
      ...data,
      userId: request.user?.sub,
    });
    const inventoryRead = await getInventoryById.execute(inventory.id);

    return reply.send(HttpResponse.created(inventoryRead));
  };
}
