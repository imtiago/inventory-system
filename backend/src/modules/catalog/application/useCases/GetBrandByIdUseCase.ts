// src/modules/catalog/application/useCases/CreateBrand.ts
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class GetBrandById {
  constructor(private repository: BrandRepository) {}

  async execute(id: string): Promise<Brand | null> {
    return this.repository.findById(id);
  }
}
