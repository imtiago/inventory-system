import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { InventoryBoxWithExtendsDTO } from "../../dto/InventoryBoxDTO";

export class GetInventoryBoxByCodeUseCase {
  constructor(private repository: InventoryBoxReadRepository) {}

  /** Caixa com o que há nela: cada item traz `quantity` (neste lote, nesta caixa). */
  async execute(code: string): Promise<InventoryBoxWithExtendsDTO | null> {
    return this.repository.getByCode(code);
  }
}
