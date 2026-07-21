import { ListProductsUseCase } from "@catalog/application/useCases/ListProductsUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";

export function makeListProductsUseCase() {
  const repository = new PrismaProductRepository();
  return new ListProductsUseCase(repository);
}
