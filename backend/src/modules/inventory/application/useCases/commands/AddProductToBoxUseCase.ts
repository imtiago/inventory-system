import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import {
  IAddProductToBoxInput,
  IInventoryBoxStockOutput,
} from "@inventory/application/dto/InventoryBoxStockDTO";

export class AddProductToBoxUseCase extends TransactionalUseCase<
  IAddProductToBoxInput,
  IInventoryBoxStockOutput
> {
  constructor(
    private readonly inventoryBoxRepository: IInventoryBoxRepository,
    private readonly inventoryBoxStockRepository: IInventoryBoxStockRepository,
    private readonly inventoryLotRepository: InventoryLotRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IAddProductToBoxInput,
    tx: Prisma.TransactionClient,
  ): Promise<IInventoryBoxStockOutput> {
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
      existingStock.addQuantity(request.quantity);
      return this.inventoryBoxStockRepository.update(existingStock);
    }

    const stock = new InventoryBoxStock({
      inventoryLotId: request.inventoryLotId,
      boxId: request.boxId,
      quantity: request.quantity,
    });

    const data = await this.inventoryBoxStockRepository.create(stock);
    return {
      id: data.id,
      boxId: data.boxId,
      inventoryLotId: data.inventoryLotId,
      quantity: data.quantity,
    };
  }
}
