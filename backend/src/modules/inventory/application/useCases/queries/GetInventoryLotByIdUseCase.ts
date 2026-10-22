import { IInventoryLotOutput } from "@inventory/application/dto/InventoryLotDTO";
import { IInventoryLotRepository } from "@inventory/domain/repositories/InventoryLotRepository";

export class GetInventoryLotByIdUseCase {
  constructor(private repository: IInventoryLotRepository) {}

  async execute(id: string): Promise<IInventoryLotOutput | null> {
    const data = await this.repository.findById(id);
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
      availableQuantity: data.availableQuantity,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      batchNumber: data.batchNumber,
      expirationDate: data.expirationDate,
      minimumStock: data.minimumStock,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
