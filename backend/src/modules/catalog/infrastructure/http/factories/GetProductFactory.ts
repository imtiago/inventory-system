import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { GetProductUseCase } from "../useCases/GetProductUseCase";

export function makeGetProductUseCase() {
  const repository = new PrismaProductRepository();
  return new GetProductUseCase(repository);
}
