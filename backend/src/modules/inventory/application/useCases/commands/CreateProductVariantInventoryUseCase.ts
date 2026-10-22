import { CatalogService } from "@catalog/application/services/CatalogService";
import { ICreateInventoryInput } from "@inventory/application/dto/InventoryDTO";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";

/** Cria o inventário (saldo 0) de uma variante que ainda não tem. */
export class CreateProductVariantInventoryUseCase extends TransactionalUseCase<
  ICreateInventoryInput,
  Inventory
> {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly inventoryRepository: IInventoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateInventoryInput): Promise<Inventory> {
    const variant = await this.catalogService.getProductVariant(
      request.productVariantId,
    );
    if (!variant) throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);

    const existing = await this.inventoryRepository.findByProductVariantId(
      request.productVariantId,
    );
    if (existing) throw new ConflictError("Já existe estoque para esta variante.", ErrorCodes.INVENTORY_ALREADY_EXISTS);

    return this.inventoryRepository.create(
      new Inventory({ productVariantId: request.productVariantId }),
    );
  }
}
