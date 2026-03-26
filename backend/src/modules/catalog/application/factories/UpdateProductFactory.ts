import { PrismaProductRepository } from "@catalog/infrastructure/repositories/PrismaProductRepository";
import { UpdateProductUseCase } from "../useCases/UpdateProductUseCase";

export function makeUpdateProductUseCase() {
  const repository = new PrismaProductRepository();
  return new UpdateProductUseCase(repository);
}
