// /home/tiago/projects/inventory-system/backend/src/modules/catalog/application/useCases/CreateProduct.ts
import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { v4 as uuid } from "uuid";

interface CreateProductDTO {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}

export class CreateProduct {
  constructor(private repo: ProductRepository) {}

  async execute(data: CreateProductDTO): Promise<Product> {
    const product = new Product({
      id: uuid(), // ✅ adiciona o ID
      name: data.name,
      description: data.description ?? null, // garante string | null
      brandId: data.brandId,
      categoryId: data.categoryId,
      createdAt: new Date(), // opcional, mas garante compatibilidade
    });

    return this.repo.create(product);
  }
}
