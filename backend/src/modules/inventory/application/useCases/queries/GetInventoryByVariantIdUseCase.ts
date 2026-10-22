import { InventoryReadRepository } from "../../contracts/InventoryReadRepository";
import { InventoryWithExtendsDTO } from "../../dto/InventoryDTO";

export class GetInventoryByVariantIdUseCase {
  constructor(private readonly repository: InventoryReadRepository) {}

  async execute(
    productVariantId: string,
  ): Promise<InventoryWithExtendsDTO | null> {
    return this.repository.getByVariantId(productVariantId);
  }
}
