import { IBrandOutput } from "@catalog/application/dto/BrandDTO";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

export class GetBrandByIdUseCase {
  constructor(private repository: BrandRepository) {}

  async execute(id: string): Promise<IBrandOutput | null> {
    const data = await this.repository.findById(id);
    if (!data) return null;

    return { id: data.id, name: data.name };
  }
}
