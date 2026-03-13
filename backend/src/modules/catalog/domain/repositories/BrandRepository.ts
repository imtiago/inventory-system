// src/modules/catalog/domain/repositories/BrandRepository.ts
import { Brand } from "../entities/Brand";

export interface BrandRepository {
  create(brand: Brand): Promise<Brand>;
  list(page: number, limit: number): Promise<Brand[]>;
}
