import { StockMovementOrigin } from "@inventory/domain/enums/StockMovementOrigin";
import { StockMovementOrigin as PrismaStockMovementOrigin } from "@prisma/client";

export class StockMovementOriginMapper {
  static toPrisma(type: StockMovementOrigin): PrismaStockMovementOrigin {
    return type as PrismaStockMovementOrigin;
  }

  static toDomain(type: StockMovementOrigin): PrismaStockMovementOrigin {
    return type as PrismaStockMovementOrigin;
  }
}
