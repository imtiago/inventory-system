import { GetProductUseCase } from "@catalog/application/useCases/GetProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";

export function makeGetProductUseCase() {
  const repository = new PrismaProductRepository();
  return new GetProductUseCase(repository);
}
