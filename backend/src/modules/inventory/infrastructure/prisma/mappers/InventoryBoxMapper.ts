import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { InventoryBox as PrismaInventoryBox, Prisma } from "@prisma/client";

export class InventoryBoxMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaInventoryBox): InventoryBox {
    return new InventoryBox({
      id: prisma.id,
      code: prisma.code,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    box: InventoryBox,
  ): Prisma.InventoryBoxCreateInput {
    return {
      id: box.id,
      code: box.code,
      updatedAt: box.updatedAt,
      createdAt: box.createdAt,
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(
    box: InventoryBox,
  ): Prisma.InventoryBoxUpdateInput {
    return {
      // quantity: box.quantity,
      // reservedQuantity: box.reservedQuantity,
      // minimumStock: box.minimumStock,
    };
  }
}
