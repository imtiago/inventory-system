import { FastifyRequest, FastifyReply } from "fastify";
import { HttpResponse } from "@shared/http/response";
import { makeGetInventoryBoxByIdUseCase } from "../factories/GetInventoryBoxByIdFactory";
import { createInventoryLotSchema } from "@inventory/interfaces/http/schemas/createInventoryLotSchema";
import { makeGetInventoryByVariantId } from "../factories/GetInventoryByVariantIdFactory";
import { makeGetInventoryLotById } from "../factories/GetInventoryLotByIdFactory";
import { makeReceiveInventory } from "../factories/ReceiveInventoryFactory";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { makeGenerateInventoryByProductVariandIdUseCase } from "../factories/GenerateInventoryByProductVariandIdFactory";
import { makeCreateInventoryLot1UseCase } from "../factories/CreateInventoryLotFactory1";

export function makeCreateInventoryLotController() {
  const useCase = makeCreateInventoryLot1UseCase();
  // const useCase = makeReceiveInventory();
  const getInventoryByVariantIdUseCase = makeGetInventoryByVariantId();
  const getInventoryLotByIdUseCase = makeGetInventoryLotById();
  const generateInventoryByProductVariandIdUseCase =
    makeGenerateInventoryByProductVariandIdUseCase();

  return async function CreateInventoryLotController(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const currentUser = request.user?.sub as string;
      const data = createInventoryLotSchema.parse(request.body);
      let inventory = await getInventoryByVariantIdUseCase.execute(
        data.productVariantId,
      );
      if (!inventory) {
        // return reply.status(404).send({ message: "Inventory not found" });
        inventory = await generateInventoryByProductVariandIdUseCase.handle({
          productVariantId: data.productVariantId,
        });
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
        userId: currentUser,
      });
      const lotRead = await getInventoryLotByIdUseCase.execute(lot.id);

      return reply.send(HttpResponse.created(lotRead));
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  };
}
