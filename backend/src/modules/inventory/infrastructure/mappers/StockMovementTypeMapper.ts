// src/modules/inventory/application/mappers/StockMovementTypeMapper.ts

import { StockMovementType } from "../../domain/entities/StockMovement";
import { StockMovementType as PrismaStockMovementType } from "@prisma/client";

export class StockMovementTypeMapper {
  static toPrisma(type: StockMovementType): PrismaStockMovementType {
    return type as PrismaStockMovementType;
  }

  static toDomain(type: PrismaStockMovementType): StockMovementType {
    return type as StockMovementType;
  }
}
