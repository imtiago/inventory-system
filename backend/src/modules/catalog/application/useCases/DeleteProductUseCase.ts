import { ProductRepository } from "../../domain/repositories/ProductRepository";

export class DeleteProductUseCase {
  constructor(private repository: ProductRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) throw new Error("Produto não encontrado");

    await this.repository.delete(id);
  }
}
