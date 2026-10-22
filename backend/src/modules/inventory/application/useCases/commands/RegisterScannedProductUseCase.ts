import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { IRegisterScannedProductInput } from "@inventory/application/dto/InventoryDTO";
import { ReceiveInventoryUseCase } from "./ReceiveInventoryUseCase";
import { AddProductToBoxUseCase } from "./AddProductToBoxUseCase";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

export interface IRegisterScannedProductOutput {
  boxId: string;
  boxCode: string;
  inventoryLotId: string;
  quantity: number;
}

export class RegisterScannedProductUseCase extends TransactionalUseCase<
  IRegisterScannedProductInput,
  IRegisterScannedProductOutput
> {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly receiveInventory: ReceiveInventoryUseCase,
    private readonly addProductToBox: AddProductToBoxUseCase,
    private readonly inventoryRepository: IInventoryRepository,
    private readonly inventoryBoxRepository: IInventoryBoxRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IRegisterScannedProductInput,
  ): Promise<IRegisterScannedProductOutput> {
    const quantity = request.quantity ?? 1;

    if (!(quantity > 0)) {
      throw new BusinessRuleError("A quantidade deve ser maior que zero.", ErrorCodes.INVALID_QUANTITY);
    }

    const variant = await this.catalogService.getProductVariantByBarcode(
      request.barcode,
    );

    if (!variant) {
      throw new NotFoundError("Produto não encontrado para o código de barras lido.", ErrorCodes.VARIANT_NOT_FOUND);
    }

    // Resolve the box before receiving so a missing box writes nothing.
    const box = await this.inventoryBoxRepository.findByCode(request.boxCode);

    if (!box) {
      throw new NotFoundError("Caixa não encontrada.", ErrorCodes.BOX_NOT_FOUND);
    }

    const unitCost =
      request.unitCost ??
      (await this.inventoryRepository.findByProductVariantId(variant.id))
        ?.averageCost ??
      0;

    const { lot } = await this.receiveInventory.execute({
      productVariantId: variant.id,
      quantity,
      unitCost,
      batchNumber: request.batchNumber,
      expirationDate: request.expirationDate,
      origin: StockMovementOrigin.INVENTORY,
      sourceType: InventoryLotSource.MANUAL,
      userId: request.userId,
    });

    await this.addProductToBox.execute({
      inventoryLotId: lot.id,
      boxId: box.id,
      quantity,
    });

    return {
      boxId: box.id,
      boxCode: box.code,
      inventoryLotId: lot.id,
      quantity,
    };
  }
}
