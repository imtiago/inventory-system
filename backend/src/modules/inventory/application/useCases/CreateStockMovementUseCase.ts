import { InventoryRepository } from "../../domain/repositories/InventoryRepository";
import { Inventory } from "../../domain/entities/Inventory";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { StockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";
import { CatalogService } from "@catalog/application/services/CatalogService";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";

interface CreateStockMovementRequest {
  productVariantId: string;
  type: StockMovementType;
  origin: StockMovementOrigin;
  quantity: number;
  originId?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export class CreateStockMovement extends TransactionalUseCase<
  CreateStockMovementRequest,
  StockMovement
> {
  constructor(
    private inventoryRepo: InventoryRepository,
    private movementRepo: StockMovementRepository,
    private catalogoService: CatalogService,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateStockMovementRequest,
    tx: Prisma.TransactionClient,
  ): Promise<StockMovement> {
    let inventory = await this.inventoryRepo.findByVariant(
      request.productVariantId,
      tx,
    );

    if (!inventory) {
      const variant = await this.catalogoService.getProductVariant(
        request.productVariantId,
      );
      if (!variant) return new Error("variante não encontrada");
      inventory = new Inventory({
        productVariantId: request.productVariantId,
      });
    }

    switch (request.type) {
      case StockMovementType.IN:
        inventory.increase(request.quantity);

        break;

      case StockMovementType.OUT:
        inventory.decrease(request.quantity);

        break;

      case StockMovementType.ADJUSTMENT:
        inventory.adjust(request.quantity);

        break;

      default:
        throw new Error("Invalid stock movement type");
    }

    inventory.adjust(request.quantity);
    await this.inventoryRepo.save(inventory, tx);

    const movement = new StockMovement({
      inventoryId: inventory.id!,

      productVariantId: request.productVariantId,

      type: request.type,

      origin: request.origin,

      quantity: request.quantity,

      originId: request.originId,

      userId: request.userId,

      notes: request.notes,
    });

    await this.movementRepo.create(movement, tx);

    return movement;
  }
}
