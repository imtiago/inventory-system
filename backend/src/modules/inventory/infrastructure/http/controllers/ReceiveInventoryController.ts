import { applyEntryExtraCost } from "./entryExtraCost";
import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { parseInput } from "@shared/http/parseInput";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { receiveInventorySchema } from "@inventory/interfaces/http/schemas/receiveInventorySchema";
import { makeGetInventoryByIdUseCase } from "../factories/GetInventoryByIdFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";

export function makeReceiveInventoryController() {
  const useCase = makeReceiveInventory();
  const getInventoryById = makeGetInventoryByIdUseCase();

  return async function ReceiveInventoryController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const data = parseInput(receiveInventorySchema, request.body);

    const { unitCost, acquisitionExtraCost } = applyEntryExtraCost(data);

    const { inventory } = await useCase.execute({
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      unitCost,
      acquisitionExtraCost,
      batchNumber: data.batchNumber,
      expirationDate: data.expirationDate,
      manufacturingDate: data.manufacturingDate,
      origin: StockMovementOrigin[data.origin],
      // Entrada manual: o lote é sempre MANUAL (PURCHASE/IMPORT/RETURN são internos).
      sourceType: InventoryLotSource.MANUAL,
      originReferenceId: data.originReferenceId,
      notes: data.notes,
      userId: request.user?.sub,
    });
    const inventoryRead = await getInventoryById.execute(inventory.id);

    return reply.send(HttpResponse.created(inventoryRead));
  };
}
