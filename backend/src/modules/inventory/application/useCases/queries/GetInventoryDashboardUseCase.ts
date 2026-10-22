import { InventoryReadRepository } from "../../contracts/InventoryReadRepository";
import { InventoryDashboardDTO } from "../../dto/InventoryDashboardDTO";

export class GetInventoryDashboardUseCase {
  constructor(private readonly inventoryRepository: InventoryReadRepository) {}

  async execute(): Promise<InventoryDashboardDTO> {
    return this.inventoryRepository.getDashboard();
  }
}
