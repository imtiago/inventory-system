import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";

interface Request {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}

export class CreateProduct {
  constructor(private productRepository: ProductRepository) {}

  async execute(data: Request) {
    const product = new Product({
      name: data.name,
      description: data.description,
      brandId: data.brandId,
      categoryId: data.categoryId,
    });

    return this.productRepository.create(product);
  }
}
