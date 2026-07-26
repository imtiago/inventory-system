import { StockMovementType } from "@inventory/domain/enums/StockMovementType";
import { StockMovementType as PrismaStockMovementType } from "@prisma/client";

export class StockMovementTypeMapper {
  static toPrisma(type: StockMovementType): PrismaStockMovementType {
    return type as PrismaStockMovementType;
  }

  static toDomain(type: PrismaStockMovementType): StockMovementType {
    return type as StockMovementType;
  }
}
