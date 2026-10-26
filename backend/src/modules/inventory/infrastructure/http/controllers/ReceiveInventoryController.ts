import { divideCentsRoundHalfUp, toCents, unitCostFromCents } from "@shared/domain/money";
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

    // Despesa total da entrada → custo efetivo por unidade (aritmética inteira em 1/10.000 de real).
    const extraCents = toCents(data.extraCost ?? 0);
    const unitCost =
      extraCents > 0
        ? divideCentsRoundHalfUp(Math.round(data.unitCost * 10_000) * data.quantity + extraCents * 100, data.quantity) / 10_000
        : data.unitCost;

    const { inventory } = await useCase.execute({
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      unitCost,
      acquisitionExtraCost: extraCents > 0 ? unitCostFromCents(extraCents, data.quantity) : undefined,
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
