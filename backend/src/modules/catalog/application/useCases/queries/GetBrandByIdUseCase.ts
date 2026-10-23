import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { BrandDTO } from "@catalog/application/dto/BrandDTO";
import { brandNotFound } from "@catalog/domain/errors/brandCategoryErrors";

export class GetBrandByIdUseCase {
  constructor(private repository: BrandReadRepository) {}

  async execute(id: string): Promise<BrandDTO> {
    const brand = await this.repository.getById(id);
    if (!brand) throw brandNotFound();
    return brand;
  }
}
