import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryBoxByIdUseCase } from "../factories/GetInventoryBoxByIdFactory";
import { makeCreateInventoryLotUseCase } from "../factories/CreateInventoryLotFactory";
import { createInventoryLotSchema } from "@inventory/interfaces/http/schemas/createInventoryLotSchema";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { makeGetInventoryLotById } from "../factories/GetInventoryLotByIdFactory";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

export function makeCreateInventoryLotController() {
  const useCase = makeCreateInventoryLotUseCase();
  // const useCase = makeReceiveInventory();
  const getInventoryByVariantIdUseCase = makeGetInventoryByVariantId();
  const getInventoryLotByIdUseCase = makeGetInventoryLotById();

  return async function CreateInventoryLotController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const data = createInventoryLotSchema.parse(request.body);
      const inventory = await getInventoryByVariantIdUseCase.execute(
        data.productVariantId,
      );
      if (!inventory) {
        return reply.status(404).send({ message: "Inventory not found" });
      }

      // const lot = await useCase.execute({
      //   // inventoryId: inventory.id,
      //   productVariantId: inventory.productVariantId,
      //   expirationDate: new Date(data.expirationDate),
      //   batchNumber: data.batchNumber,
      //   quantity: data.quantity,

      // });
      const lot = await useCase.execute({
        inventoryId: inventory.id,
        productVariantId: data.productVariantId,
        expirationDate: new Date(data.expirationDate),
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        unitCost: data.unitCost,
        origin: StockMovementOrigin.MANUAL,
        userId: "852da500-e5e3-41ac-baa3-da283139ecd5",
      });
      const lotRead = await getInventoryLotByIdUseCase.execute(lot.id);

      return reply.send(HttpResponse.created(lotRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
