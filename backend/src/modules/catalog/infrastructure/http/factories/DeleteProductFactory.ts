import { DeleteProductUseCase } from "@catalog/application/useCases/DeleteProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";

export function makeDeleteProductUseCase() {
  const repository = new PrismaProductRepository();
  return new DeleteProductUseCase(repository);
}
