// src/modules/sales/infrastructure/mappers/SaleStatusMapper.ts

import { SaleStatus as PrismaSaleStatus } from "@prisma/client";
import { SaleStatus } from "@sales/domain/enums/SaleStatus";

export class SaleStatusMapper {
  static toPrisma(status: SaleStatus): PrismaSaleStatus {
    return status as PrismaSaleStatus;
  }

  static toDomain(status: PrismaSaleStatus): SaleStatus {
    return status as SaleStatus;
  }
}
