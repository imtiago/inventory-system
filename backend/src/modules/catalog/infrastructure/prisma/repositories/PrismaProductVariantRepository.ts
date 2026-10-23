import { Prisma } from "@prisma/client";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { ProductVariantMapper } from "../mappers/ProductVariantMapper";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";

function assertInTransaction(what: string): void {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError(
      `Trava de ${what} exige transação ativa.`,
      InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
    );
  }
}

export class PrismaProductVariantRepository implements ProductVariantRepository {
  async create(variant: ProductVariant): Promise<ProductVariant> {
    const created = await getDb().productVariant.create({
      data: ProductVariantMapper.toCreatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(created);
  }

  async update(variant: ProductVariant): Promise<ProductVariant> {
    const updated = await getDb().productVariant.update({
      where: {
        id: variant.id,
      },
      data: ProductVariantMapper.toUpdatePersistence(variant),
    });

    return ProductVariantMapper.toDomain(updated);
  }

  async findById(id: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findUnique({
      where: {
        id,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }

  async findByProduct(productId: string): Promise<ProductVariant[]> {
    const variants = await getDb().productVariant.findMany({
      where: {
        productId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return variants.map(ProductVariantMapper.toDomain);
  }

  async delete(id: string): Promise<void> {
    await getDb().productVariant.delete({
      where: {
        id,
      },
    });
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findFirst({
      where: {
        barcode,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }

  async findByCode(code: string): Promise<ProductVariant | null> {
    const variant = await getDb().productVariant.findUnique({
      where: {
        code,
      },
    });

    if (!variant) {
      return null;
    }

    return ProductVariantMapper.toDomain(variant);
  }

  async lockByProduct(productId: string): Promise<string[]> {
    assertInTransaction("variantes");
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "ProductVariant" WHERE "productId" = ${productId} ORDER BY id FOR UPDATE`;
    return rows.map((r) => r.id);
  }

  async findInUse(variantIds: string[]): Promise<string[]> {
    if (variantIds.length === 0) return [];
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT v.id FROM "ProductVariant" v
      WHERE v.id IN (${Prisma.join(variantIds)})
        AND (
          EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."productVariantId" = v.id)
          OR EXISTS (SELECT 1 FROM "InventoryLot" l WHERE l."productVariantId" = v.id)
          OR EXISTS (SELECT 1 FROM "SaleItem" s WHERE s."productVariantId" = v.id)
          OR EXISTS (SELECT 1 FROM "PurchaseItem" p WHERE p."productVariantId" = v.id)
          OR EXISTS (
            SELECT 1 FROM "Inventory" i
            WHERE i."productVariantId" = v.id AND (i.quantity <> 0 OR i."reservedQuantity" <> 0)
          )
        )`;
    return rows.map((r) => r.id);
  }

  async deleteWithInventory(variantIds: string[]): Promise<void> {
    if (variantIds.length === 0) return;
    await getDb().inventory.deleteMany({ where: { productVariantId: { in: variantIds } } });
    await getDb().productVariant.deleteMany({ where: { id: { in: variantIds } } });
  }
}
