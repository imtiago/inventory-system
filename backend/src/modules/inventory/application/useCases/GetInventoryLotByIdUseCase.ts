import { InventoryLot } from "@inventory/domain/entities/InventoryLot";
import { InventoryLotReadRepository } from "../contracts/InventoryLotReadRepository";

export class GetInventoryLotByIdUseCase {
  constructor(private repository: InventoryLotReadRepository) {}

  async execute(id: string): Promise<InventoryLot | null> {
    return this.repository.getById(id);
  }
}
