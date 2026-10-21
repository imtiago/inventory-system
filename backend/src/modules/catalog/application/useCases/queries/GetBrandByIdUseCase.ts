import { Brand } from "@catalog/domain/entities/Brand";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

export class GetBrandByIdUseCase {
  constructor(private repository: BrandRepository) {}

  async execute(id: string): Promise<Brand | null> {
    return this.repository.findById(id);
  }
}
