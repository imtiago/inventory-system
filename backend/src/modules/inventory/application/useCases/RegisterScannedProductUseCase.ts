import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { InventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { InventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";

export interface RegisterScannedProductInput {
  barcode: string;
  boxCode: string;
  batchNumber?: string;
  expirationDate?: Date;
}

export class RegisterScannedProductUseCase extends TransactionalUseCase<
  RegisterScannedProductInput,
  InventoryBox
> {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryLotRepository: InventoryLotRepository,
    private readonly inventoryBoxRepository: InventoryBoxRepository,
    private readonly inventoryBoxStockRepository: InventoryBoxStockRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: RegisterScannedProductInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryBox> {
    /**
     * 1. Localizar produto pelo código de barras
     */
    const productVariant = await this.catalogService.getProductVariantByBarcode(
      request.barcode,
    );

    if (!productVariant) {
      throw new Error("Product not found for the scanned barcode.");
    }

    /**
     * 2. Localizar caixa
     */
    const box = await this.inventoryBoxRepository.findByCode(
      request.boxCode,
      tx,
    );

    if (!box) {
      throw new Error(`Inventory box "${request.boxCode}" not found.`);
    }

    /**
     * 3. Localizar estoque do produto
     */
    const inventory = await this.inventoryRepository.findByVariant(
      productVariant.id,
      tx,
    );

    if (!inventory) {
      throw new Error("Inventory not found for this product.");
    }

    /**
     * 4. Procurar lote
     */
    // let lot = await this.inventoryLotRepository.findByBatchNumber(
    //   productVariant.id,
    //   request.batchNumber ?? null,
    // );
    let lot = await this.inventoryLotRepository.findByVariant(
      productVariant.id,
      tx,
    );
    // let lot = null;

    /**
     * 5. Se o lote não existir,
     * precisamos criar um novo lote.
     */
    if (!lot) {
      lot = await this.inventoryLotRepository.save(
        new InventoryLot({
          inventoryId: inventory.id,
          productVariantId: productVariant.id,
          sourceType: "MANUAL",
          sourceId: null,
          initialQuantity: 0,
          remainingQuantity: 0,
          unitCost: 0,
          batchNumber: request.batchNumber ?? null,
          manufacturingDate: null,
          expirationDate: request.expirationDate ?? null,
        }),
        tx,
      );
    }
    /**
     * 6. Adicionar a unidade à caixa
     */
    const stock = await this.inventoryBoxStockRepository.findStock(
      lot.id,
      box.id,
      tx,
    );

    if (stock) {
      await this.inventoryBoxStockRepository.update(
        stock.id,
        stock.quantity + 1,
        tx,
      );
    } else {
      await this.inventoryBoxStockRepository.create(
        new InventoryBoxStock({
          inventoryLotId: lot.id,
          boxId: box.id,
          quantity: 1,
        }),
        tx,
      );
    }

    /**
     * 7. Retornar resumo
     */
    return {
      productVariantId: productVariant.id,
      productCode: productVariant.code,
      barcode: productVariant.barcode,
      boxId: box.id,
      boxCode: box.code,
      inventoryLotId: lot.id,
    };
  }
}
