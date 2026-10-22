import { InventoryLotReadRepository } from "../../contracts/InventoryLotReadRepository";
import { InventoryLotDTO } from "../../dto/InventoryLotDTO";

export class GetInventoryLotByIdUseCase {
  constructor(private readonly repository: InventoryLotReadRepository) {}

  async execute(id: string): Promise<InventoryLotDTO | null> {
    return this.repository.getById(id);
  }
}
