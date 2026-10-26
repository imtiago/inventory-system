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

    // Trava a variante antes de ler o custo médio padrão (a trava é reentrante
    // na transação do receive), para o custo não ficar defasado por concorrência.
    const inventory = await this.inventoryRepository.lockByProductVariantId(variant.id);
    const unitCost = request.unitCost ?? inventory.averageCost ?? 0;

    // Sem lote informado: lote "aberto" da contagem, um por variante e caixa.
    const batchNumber = request.batchNumber ?? `CONT-${box.code}-${variant.code}`;

    const { lot } = await this.receiveInventory.execute({
      productVariantId: variant.id,
      quantity,
      unitCost,
      batchNumber,
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
