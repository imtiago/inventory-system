import { GetProductByIdUseCase } from "@catalog/application/useCases/queries/GetProductByIdUseCase";
import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductReadRepository";

export function makeGetProductByIdUseCase() {
  const repository = new PrismaProductReadRepository();

  return new GetProductByIdUseCase(repository);
}
