import { randomUUID } from "node:crypto";
import { Inventory as PrismaInventory } from "@prisma/client";
import {
  getDb,
  hasActiveTransaction,
} from "@shared/infrastructure/prisma/transactionContext";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { Inventory } from "../../../domain/entities/Inventory";
import { IInventoryRepository } from "../../../domain/repositories/InventoryRepository";
import { InventoryMapper } from "../mappers/InventoryMapper";

export class PrismaInventoryRepository implements IInventoryRepository {

  async findByProductVariantId(
    productVariantId: string
  ) {
    const inventory = await getDb().inventory.findUnique({
      where: {
        productVariantId,
      },
    });

    if (!inventory) {
      return null;
    }

    return InventoryMapper.toDomain(inventory);
  }

  async lockByProductVariantId(productVariantId: string): Promise<Inventory> {
    this.assertInTransaction();
    const db = getDb();
    await db.$executeRaw`
      INSERT INTO "Inventory" ("id", "productVariantId", "updatedAt")
      VALUES (${randomUUID()}, ${productVariantId}, now())
      ON CONFLICT ("productVariantId") DO NOTHING`;
    const rows = await db.$queryRaw<PrismaInventory[]>`
      SELECT * FROM "Inventory" WHERE "productVariantId" = ${productVariantId} FOR UPDATE`;
    return InventoryMapper.toDomain(rows[0]);
  }

  async lockExistingByProductVariantId(
    productVariantId: string
  ): Promise<Inventory | null> {
    this.assertInTransaction();
    const rows = await getDb().$queryRaw<PrismaInventory[]>`
      SELECT * FROM "Inventory" WHERE "productVariantId" = ${productVariantId} FOR UPDATE`;
    return rows[0] ? InventoryMapper.toDomain(rows[0]) : null;
  }

  private assertInTransaction(): void {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de inventário exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
  }

  async findById(id: string) {
    const data = await getDb().inventory.findUnique({
      where: {
        id,
      },
    });

    if (!data) {
      return null;
    }

    return InventoryMapper.toDomain(data);
  }

  async create(entity: Inventory) {
    const data = await getDb().inventory.create({
      data: InventoryMapper.toCreatePersistence(entity),
    });

    return InventoryMapper.toDomain(data);
  }

  async delete(id: string) {
    await getDb().inventory.delete({
      where: {
        id,
      },
    });
  }

  async update(entity: Inventory): Promise<Inventory> {
    const updated = await getDb().inventory.update({
      where: {
        id: entity.id,
      },
      data: InventoryMapper.toUpdatePersistence(entity),
    });

    return InventoryMapper.toDomain(updated);
  }
}
