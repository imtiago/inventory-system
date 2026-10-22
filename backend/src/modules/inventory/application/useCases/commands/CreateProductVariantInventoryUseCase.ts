import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { CreateInventoryUseCase } from "./CreateInventoryUseCase";
import { GetInventoryByVariantId } from "../queries/GetInventoryByVariantIdUseCase";
import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";
import {
  ICreateInventoryInput,
  IInventoryOutput,
} from "@inventory/application/dto/InventoryDTO";

export class CreateProductVariantInventoryUseCase {
  // export class CreateProductVariantInventoryUseCase extends TransactionalUseCase<
  //   ICreateInventoryInput,
  //   Inventory
  // > {
  constructor(
    private readonly catalogService: CatalogApplicationService,
    private readonly getInventoryByVariantId: GetInventoryByVariantId,
    private readonly createInventoryUseCase: CreateInventoryUseCase,
    // transactionManager: TransactionManager,
  ) {
    // super(transactionManager);
  }

  async handle(
    request: ICreateInventoryInput,
  ): Promise<IInventoryOutput> {
    const existProductVariant = await this.catalogService.getProductVariant(
      request.productVariantId,
    );
    if (!existProductVariant) throw new Error("ProductVariant not exist");

    const existInventory = await this.getInventoryByVariantId.execute(
      request.productVariantId,
    );
    if (existInventory) throw new Error("Inventory exist");

    const inventory = new Inventory({
      productVariantId: request.productVariantId,
    });

    const data = await this.createInventoryUseCase.execute(inventory);
    return {
      id: data.id,
      availableQuantity: data.availableQuantity,
      code: data.code,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
