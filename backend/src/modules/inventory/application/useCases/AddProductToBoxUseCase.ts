import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";

export interface AddProductToBoxInput {
  inventoryLotId: string;
  boxId: string;
  quantity: number;
}

export class AddProductToBoxUseCase extends TransactionalUseCase<
  AddProductToBoxInput,
  InventoryBoxStock
> {
  constructor(
    private readonly inventoryBoxRepository: InventoryBoxRepository,
    private readonly inventoryBoxStockRepository: InventoryBoxStockRepository,
    private readonly inventoryLotRepository: InventoryLotRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: AddProductToBoxInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryBoxStock> {
    if (request.quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

    const box = await this.inventoryBoxRepository.findById(request.boxId);

    if (!box) {
      throw new Error("Inventory box not found.");
    }

    const lot = await this.inventoryLotRepository.findById(
      request.inventoryLotId,
    );

    if (!lot) {
      throw new Error("Inventory lot not found.");
    }

    const existingStock = await this.inventoryBoxStockRepository.findStock(
      request.inventoryLotId,
      request.boxId,
    );

    if (existingStock) {
      return this.inventoryBoxStockRepository.update(
        existingStock.id,
        existingStock.quantity + request.quantity,
        tx,
      );
    }

    const stock = new InventoryBoxStock({
      inventoryLotId: request.inventoryLotId,
      boxId: request.boxId,
      quantity: request.quantity,
    });

    return this.inventoryBoxStockRepository.create(stock);
  }
}
