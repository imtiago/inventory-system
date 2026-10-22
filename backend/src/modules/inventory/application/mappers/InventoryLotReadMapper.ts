import { InventoryLotDTO } from "../dto/InventoryLotDTO";

export class InventoryLotReadMapper {
  /**
   * `data.boxStocks` (quantidades das caixas do lote) deve vir carregado para
   * calcular `allocatedQuantity`.
   */
  static toDTO(data: any): InventoryLotDTO {
    if (!Array.isArray(data.boxStocks)) {
      throw new Error("InventoryLotReadMapper: boxStocks not loaded.");
    }
    return {
      id: data.id,
      inventoryId: data.inventoryId,
      productVariantId: data.productVariantId,
      batchNumber: data.batchNumber ?? null,
      initialQuantity: data.initialQuantity,
      remainingQuantity: data.remainingQuantity,
      allocatedQuantity: data.boxStocks.reduce(
        (sum: number, stock: { quantity: number }) => sum + stock.quantity,
        0,
      ),
      unitCost: Number(data.unitCost),
      sourceType: data.sourceType,
      manufacturingDate: data.manufacturingDate ?? null,
      expirationDate: data.expirationDate ?? null,
      createdAt: data.createdAt,
    };
  }
}
