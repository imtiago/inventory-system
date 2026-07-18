// src/modules/catalog/application/useCases/CreateBrand.ts
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class CreateBrandUseCase {
  constructor(private repository: BrandRepository) {}

  async execute(data: { name: string }): Promise<Brand> {
    const brand = new Brand({
      name: data.name,
    });

    return this.repository.create(brand);
  }
}
