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
  quantity?: number;
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
     * Quantidade padrão:
     *
     * se quantity não for informada,
     * registra apenas 1 unidade.
     */
    const quantity = request.quantity ?? 1;

    if (quantity <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }

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
     * 4. Localizar lote pelo produto + lote
     */
    let lot =
      await this.inventoryLotRepository.findByProductVariantIdAndBatchNumber(
        productVariant.id,
        request.batchNumber!,
        tx,
      );

    /**
     * 5. Criar lote caso ainda não exista
     */
    if (!lot) {
      lot = await this.inventoryLotRepository.save(
        new InventoryLot({
          inventoryId: inventory.id,
          productVariantId: productVariant.id,
          sourceType: "MANUAL",
          sourceId: null,
          quantity,
          availableQuantity: quantity,
          unitCost: 0,
          batchNumber: request.batchNumber ?? null,
          manufacturingDate: null,
          expirationDate: request.expirationDate ?? null,
        }),
        tx,
      );
    } else {
      lot.addQuantity(quantity);

      lot = await this.inventoryLotRepository.save(lot, tx);
    }

    /**
     * 6. Atualizar estoque geral
     */
    inventory.receive({
      quantity,
      unitCost: lot.unitCost,
    });

    await this.inventoryRepository.save(inventory, tx);

    /**
     * 7. Localizar estoque da caixa
     */
    const stock = await this.inventoryBoxStockRepository.findStock(
      lot.id,
      box.id,
      tx,
    );

    /**
     * 8. Atualizar ou criar estoque da caixa
     */
    if (stock) {
      stock.addQuantity(quantity);

      await this.inventoryBoxStockRepository.update(
        stock.id,
        stock.quantity,
        tx,
      );
    } else {
      await this.inventoryBoxStockRepository.create(
        new InventoryBoxStock({
          inventoryLotId: lot.id,
          boxId: box.id,
          quantity,
        }),
        tx,
      );
    }

    /**
     * 9. Retornar resumo
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
