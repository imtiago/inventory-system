import { InventoryReadRepository } from "../../contracts/InventoryReadRepository";
import { InventoryBalanceDTO } from "../../dto/InventoryBalanceDTO";

export class ListInventoryBalancesUseCase {
  constructor(private readonly repository: InventoryReadRepository) {}

  async execute(productVariantIds: string[]): Promise<InventoryBalanceDTO[]> {
    return this.repository.listBalancesByVariantIds(productVariantIds);
  }
}
