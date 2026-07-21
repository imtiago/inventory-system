import { UpdateProductUseCase } from "@catalog/application/useCases/UpdateProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";

export function makeUpdateProductUseCase() {
  const repository = new PrismaProductRepository();
  return new UpdateProductUseCase(repository);
}
