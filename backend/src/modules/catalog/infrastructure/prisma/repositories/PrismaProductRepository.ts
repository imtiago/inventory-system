import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { ProductMapper } from "../mappers/ProductMapper";

function assertInTransaction(what: string): void {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError(
      `Trava de ${what} exige transação ativa.`,
      InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
    );
  }
}

export class PrismaProductRepository implements ProductRepository {
  async create(product: Product): Promise<Product> {
    const created = await getDb().product.create({
      data: ProductMapper.toCreatePersistence(product),
    });

    return ProductMapper.toDomain(created);
  }

  async update(product: Product): Promise<Product> {
    const updated = await getDb().product.update({
      where: { id: product.id },
      data: ProductMapper.toUpdatePersistence(product),
    });

    return ProductMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await getDb().product.delete({ where: { id } });
  }

  async findById(id: string): Promise<Product | null> {
    const product = await getDb().product.findUnique({ where: { id } });
    return product ? ProductMapper.toDomain(product) : null;
  }

  async findByCode(code: string): Promise<Product | null> {
    const product = await getDb().product.findUnique({ where: { code } });
    return product ? ProductMapper.toDomain(product) : null;
  }

  async lockById(id: string): Promise<boolean> {
    assertInTransaction("produto");
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`;
    return rows.length > 0;
  }
}
