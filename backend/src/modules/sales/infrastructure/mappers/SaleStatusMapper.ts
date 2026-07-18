// src/modules/sales/application/mappers/SaleStatusMapper.ts

import { SaleStatus } from "../../domain/enums/SaleStatus";
import { SaleStatus as PrismaSaleStatus } from "@prisma/client";

export class SaleStatusMapper {
  static toPrisma(status: SaleStatus): PrismaSaleStatus {
    return status as PrismaSaleStatus;
  }

  static toDomain(status: PrismaSaleStatus): SaleStatus {
    return status as SaleStatus;
  }
}
