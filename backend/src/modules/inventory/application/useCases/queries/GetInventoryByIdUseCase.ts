import { IInventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { IInventoryOutput } from "@inventory/application/dto/InventoryDTO";

export class GetInventoryByIdUseCase {
  constructor(private repository: IInventoryRepository) {}

  async execute(inventoryId: string): Promise<IInventoryOutput | null> {
    const data = await this.repository.findById(inventoryId);
    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
      availableQuantity: data.availableQuantity,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
