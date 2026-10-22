import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { sendBadRequest } from "@shared/http/formatZodError";
import { createInventoryLotSchema } from "@inventory/interfaces/http/schemas/createInventoryLotSchema";
import { makeGetInventoryLotById } from "../factories/GetInventoryLotByIdFactory";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";

/** Entrada manual de um lote: recebe estoque (cria o inventário se preciso). */
export function makeCreateInventoryLotController() {
  const receiveInventory = makeReceiveInventory();
  const getInventoryLotByIdUseCase = makeGetInventoryLotById();

  return async function CreateInventoryLotController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createInventoryLotSchema.parse(request.body);

      const { lot } = await receiveInventory.execute({
        productVariantId: data.productVariantId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        batchNumber: data.batchNumber,
        expirationDate: data.expirationDate,
        manufacturingDate: data.manufacturingDate,
        origin: StockMovementOrigin.INVENTORY,
        sourceType: InventoryLotSource.MANUAL,
        userId: request.user?.sub,
      });
      const lotRead = await getInventoryLotByIdUseCase.execute(lot.id);

      return reply.send(HttpResponse.created(lotRead));
    } catch (err) {
      return sendBadRequest(reply, err);
    }
  };
}
