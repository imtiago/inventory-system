import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { DeleteProductUseCase } from "../useCases/DeleteProductUseCase";

export function makeDeleteProductUseCase() {
  const repository = new PrismaProductRepository();
  return new DeleteProductUseCase(repository);
}
