import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { ListProductsUseCase } from "../useCases/ListProductsUseCase";

export function makeListProductsUseCase() {
  const repository = new PrismaProductRepository();
  return new ListProductsUseCase(repository);
}
