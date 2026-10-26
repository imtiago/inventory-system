import { InventoryApplicationService } from "@inventory/application/services/InventoryApplicationService";
import { RevertPurchaseStockUseCase } from "@inventory/application/useCases/commands/RevertPurchaseStockUseCase";
import { PrismaInventoryBoxStockRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryBoxStockRepository";
import { PrismaInventoryLotRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryLotRepository";
import { PrismaInventoryRepository } from "@inventory/infrastructure/prisma/repositories/PrismaInventoryRepository";
import { PrismaStockMovementRepository } from "@inventory/infrastructure/prisma/repositories/PrismaStockMovementRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeDispatchInventory } from "./DispatchInventoryFactory";
import { makeReceiveInventory } from "./ReceiveInventoryFactory";
import { makeReturnSaleStock } from "./ReturnSaleStockFactory";

const makeRevertPurchaseStock = () =>
  new RevertPurchaseStockUseCase(
    new PrismaInventoryRepository(),
    new PrismaInventoryLotRepository(),
    new PrismaStockMovementRepository(),
    new PrismaInventoryBoxStockRepository(),
    new PrismaTransactionManager(),
  );

export function makeInventoryService() {
  return new InventoryApplicationService(
    makeDispatchInventory(),
    makeReturnSaleStock(),
    makeReceiveInventory(),
    makeRevertPurchaseStock(),
  );
}
