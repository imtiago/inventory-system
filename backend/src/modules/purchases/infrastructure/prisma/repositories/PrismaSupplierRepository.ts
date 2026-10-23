import { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import { Supplier } from "@purchases/domain/entities/Supplier";
import { supplierDocumentAlreadyExists, supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { SupplierPatchData, SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";
import { SupplierMapper } from "../mappers/SupplierMapper";

/** Corrida entre a checagem do use case e a gravação: o índice único de document decide. */
function mapUniqueDocument(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw supplierNotFound();
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw supplierDocumentAlreadyExists();
  }
  throw error;
}

export class PrismaSupplierRepository implements SupplierRepository {
  async findById(id: string): Promise<Supplier | null> {
    const row = await getDb().supplier.findUnique({ where: { id } });
    return row ? SupplierMapper.toDomain(row) : null;
  }

  async findByDocument(document: string): Promise<Supplier | null> {
    const row = await getDb().supplier.findUnique({ where: { document } });
    return row ? SupplierMapper.toDomain(row) : null;
  }

  async create(supplier: Supplier): Promise<Supplier> {
    const created = await getDb()
      .supplier.create({ data: SupplierMapper.toCreatePersistence(supplier) })
      .catch(mapUniqueDocument);
    return SupplierMapper.toDomain(created);
  }

  async createOrGetByDocument(supplier: Supplier): Promise<Supplier> {
    // ON CONFLICT DO NOTHING espera a transação concorrente com o mesmo documento e não
    // aborta a nossa (um P2002 abortaria); o SELECT seguinte (novo snapshot) vê a linha dela.
    await getDb().$executeRaw`
      INSERT INTO "Supplier" ("id", "name", "document", "email", "phone", "createdAt", "updatedAt")
      VALUES (${supplier.id}, ${supplier.name}, ${supplier.document}, ${supplier.email}, ${supplier.phone}, now(), now())
      ON CONFLICT ("document") DO NOTHING`;
    const row = await getDb().supplier.findUniqueOrThrow({ where: { document: supplier.document } });
    return SupplierMapper.toDomain(row);
  }

  async update(id: string, patch: SupplierPatchData): Promise<Supplier> {
    const updated = await getDb()
      .supplier.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.document !== undefined ? { document: patch.document } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        },
      })
      .catch(mapUniqueDocument);
    return SupplierMapper.toDomain(updated);
  }

  async lockById(id: string): Promise<boolean> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError(
        "Trava de fornecedor exige transação ativa.",
        InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
      );
    }
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "Supplier" WHERE id = ${id} FOR UPDATE`;
    return rows.length > 0;
  }

  async countPurchases(id: string): Promise<number> {
    return getDb().purchase.count({ where: { supplierId: id } });
  }

  async delete(id: string): Promise<void> {
    await getDb().supplier.delete({ where: { id } });
  }
}
