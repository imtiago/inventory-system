import { Prisma, Supplier as PrismaSupplier } from "@prisma/client";
import { Supplier } from "@purchases/domain/entities/Supplier";

export class SupplierMapper {
  static toDomain(row: PrismaSupplier): Supplier {
    return new Supplier({
      id: row.id,
      name: row.name,
      document: row.document,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt,
    });
  }

  static toCreatePersistence(supplier: Supplier): Prisma.SupplierUncheckedCreateInput {
    return {
      id: supplier.id,
      name: supplier.name,
      document: supplier.document,
      email: supplier.email,
      phone: supplier.phone,
      createdAt: supplier.createdAt,
    };
  }
}
