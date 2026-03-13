// src/modules/catalog/application/useCases/ListBrands.ts
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class ListBrands {
  constructor(private repository: BrandRepository) {}

  async execute(page: number = 1, limit: number = 10): Promise<Brand[]> {
    return this.repository.list(page, limit);
  }
}
