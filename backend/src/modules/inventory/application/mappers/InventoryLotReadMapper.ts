import { InventoryLotSource } from "@inventory/domain/enums/InventoryLotSource";
import { InventoryLotDTO } from "../dto/InventoryLotDTO";
import type { InventoryLotRow } from "./readRows";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";

export class InventoryLotReadMapper {
  /**
   * `data.boxStocks` (quantidades das caixas do lote) deve vir carregado para
   * calcular `allocatedQuantity`.
   */
  static toDTO(data: InventoryLotRow): InventoryLotDTO {
    if (!Array.isArray(data.boxStocks)) {
      throw new InternalInvariantError("Caixas do lote não carregadas.", InternalErrorCodes.LOT_BOX_STOCKS_NOT_LOADED);
    }
    return {
      id: data.id,
      inventoryId: data.inventoryId,
      productVariantId: data.productVariantId,
      batchNumber: data.batchNumber ?? null,
      initialQuantity: data.initialQuantity,
      remainingQuantity: data.remainingQuantity,
      allocatedQuantity: data.boxStocks.reduce(
        (sum, stock) => sum + stock.quantity,
        0,
      ),
      unitCost: Number(data.unitCost),
      sourceType: data.sourceType as InventoryLotSource,
      manufacturingDate: data.manufacturingDate ?? null,
      expirationDate: data.expirationDate ?? null,
      createdAt: data.createdAt,
    };
  }
}
