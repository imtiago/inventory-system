// src/modules/catalog/application/useCases/CreateBrand.ts
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";
import crypto from "crypto";

export class CreateBrand {
  constructor(private repository: BrandRepository) {}

  async execute(data: { name: string }): Promise<Brand> {
    const brand = new Brand({
      id: crypto.randomUUID(),
      name: data.name,
      createdAt: new Date(),
    });

    return this.repository.create(brand);
  }
}
