// src/modules/inventory/infrastructure/mappers/InventoryMapper.ts

import { Inventory } from "../../domain/entities/Inventory";
import { Inventory as PrismaInventory, Prisma } from "@prisma/client";

export class InventoryMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaInventory): Inventory {
    return new Inventory({
      id: prisma.id,
      productVariantId: prisma.productVariantId,
      quantity: prisma.quantity,
      reservedQuantity: prisma.reservedQuantity,
      minimumStock: prisma.minimumStock,
      createdAt: prisma.createdAt,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(
    inventory: Inventory,
  ): Prisma.InventoryCreateInput {
    return {
      id: inventory.id,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      minimumStock: inventory.minimumStock,
      createdAt: inventory.createdAt,

      productVariant: {
        connect: {
          id: inventory.productVariantId,
        },
      },
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(
    inventory: Inventory,
  ): Prisma.InventoryUpdateInput {
    return {
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      minimumStock: inventory.minimumStock,
    };
  }
}
