import { CatalogService } from "@catalog/application/services/CatalogService";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";
import { Inventory } from "@inventory/domain/entities/Inventory";
import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { InventoryBoxStock } from "@inventory/domain/entities/InventoryBoxStock";
import { StockMovement } from "@inventory/domain/entities/StockMovement";
import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { IInventoryBoxStockRepository } from "@inventory/domain/repositories/InventoryBoxStockRepository";
import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { IStockMovementRepository } from "@inventory/domain/repositories/StockMovementRepository";

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return cloneEntity(value);
  }
  return value;
}

/** Cópia com o mesmo prototype e cópia do estado próprio (Dates compartilhadas). */
export function cloneEntity<T extends object>(entity: T): T {
  const copy = Object.create(Object.getPrototypeOf(entity)) as Record<
    string,
    unknown
  >;
  for (const key of Object.keys(entity)) {
    copy[key] = cloneValue((entity as Record<string, unknown>)[key]);
  }
  return copy as T;
}

/**
 * Armazena snapshots: grava cópia em create/update e devolve cópia em toda
 * leitura, de modo que mutar uma entidade sem chamar update() não persiste.
 */
export abstract class InMemoryRepository<T extends { id: string }> {
  private readonly store = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    const found = this.store.get(id);
    return found ? cloneEntity(found) : null;
  }

  async create(entity: T): Promise<T> {
    this.store.set(entity.id, cloneEntity(entity));
    return entity;
  }

  async update(entity: T): Promise<T> {
    if (!this.store.has(entity.id)) {
      throw new Error(`Record not found: ${entity.id}`);
    }
    this.store.set(entity.id, cloneEntity(entity));
    return entity;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) {
      throw new Error(`Record not found: ${id}`);
    }
    this.store.delete(id);
  }

  all(): T[] {
    return [...this.store.values()].map(cloneEntity);
  }
}

export class InMemoryInventoryRepository
  extends InMemoryRepository<Inventory>
  implements IInventoryRepository
{
  async findByProductVariantId(id: string): Promise<Inventory | null> {
    return this.all().find((i) => i.productVariantId === id) ?? null;
  }

  async lockByProductVariantId(id: string): Promise<Inventory> {
    const existing = await this.findByProductVariantId(id);
    if (existing) return existing;
    return this.create(new Inventory({ productVariantId: id }));
  }

  async lockExistingByProductVariantId(id: string): Promise<Inventory | null> {
    return this.findByProductVariantId(id);
  }
}

export class InMemoryInventoryLotRepository
  extends InMemoryRepository<InventoryLot>
  implements IInventoryLotRepository
{
  async findByProductVariantIdAndBatchNumber(
    productVariantId: string,
    batchNumber: string,
  ): Promise<InventoryLot | null> {
    return (
      this.all().find(
        (l) =>
          l.productVariantId === productVariantId &&
          l.batchNumber === batchNumber,
      ) ?? null
    );
  }

  /** Lotes com saldo, mais antigos primeiro (FIFO). */
  async findAvailableByInventory(inventoryId: string): Promise<InventoryLot[]> {
    return this.all()
      .filter((l) => l.inventoryId === inventoryId && l.remainingQuantity > 0)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export class InMemoryStockMovementRepository
  extends InMemoryRepository<StockMovement>
  implements IStockMovementRepository
{
  async findByProductVariantId(id: string): Promise<StockMovement[]> {
    return this.all().filter((m) => m.productVariantId === id);
  }

  async findByOrigin(origin: StockMovementOrigin, originId: string): Promise<StockMovement[]> {
    return this.all().filter((m) => m.origin === origin && m.originId === originId);
  }
}

export class InMemoryInventoryBoxRepository
  extends InMemoryRepository<InventoryBox>
  implements IInventoryBoxRepository
{
  async findByCode(code: string): Promise<InventoryBox | null> {
    return this.all().find((b) => b.code === code) ?? null;
  }
}

export class InMemoryInventoryBoxStockRepository
  extends InMemoryRepository<InventoryBoxStock>
  implements IInventoryBoxStockRepository
{
  async findStock(
    inventoryLotId: string,
    boxId: string,
  ): Promise<InventoryBoxStock | null> {
    return (
      this.all().find(
        (s) => s.inventoryLotId === inventoryLotId && s.boxId === boxId,
      ) ?? null
    );
  }

  async sumAllocatedByLot(inventoryLotId: string): Promise<number> {
    return this.all()
      .filter((s) => s.inventoryLotId === inventoryLotId)
      .reduce((sum, s) => sum + s.quantity, 0);
  }
}

export class FakeCatalogService implements CatalogService {
  constructor(private readonly variants: ProductVariantDTO[] = []) {}

  async getProductVariant(id: string): Promise<ProductVariantDTO | null> {
    return this.variants.find((v) => v.id === id) ?? null;
  }

  async getProductVariantByBarcode(
    barcode: string,
  ): Promise<ProductVariantDTO | null> {
    return this.variants.find((v) => v.barcode === barcode) ?? null;
  }
}

export function makeVariant(
  overrides: Partial<ProductVariantDTO> = {},
): ProductVariantDTO {
  return {
    id: "variant-1",
    productId: "product-1",
    code: "V1",
    name: "Variante 1",
    barcode: null,
    salePrice: 10,
    createdAt: new Date(),
    ...overrides,
  };
}
