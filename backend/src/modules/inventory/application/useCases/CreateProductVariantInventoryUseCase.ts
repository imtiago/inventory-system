import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { CreateInventoryUseCase } from "./CreateInventoryUseCase";
import { GetInventoryByVariantId } from "./GetInventoryByVariantId";
import { CatalogApplicationService } from "@catalog/application/services/CatalogApplicationService";

export interface CreateInventoryInput {
  productVariantId: string;
}

export class CreateProductVariantInventoryUseCase {
  // export class CreateProductVariantInventoryUseCase extends TransactionalUseCase<
  //   CreateInventoryInput,
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
    request: CreateInventoryInput,
    // tx: Prisma.TransactionClient,
  ): Promise<Inventory> {
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

    return await this.createInventoryUseCase.execute(inventory);
  }
}
