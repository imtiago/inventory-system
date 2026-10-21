import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductReadRepository";
import { ListProductsUseCase } from "../../../application/useCases/queries/ListPurchasesUseCase";

export function makeListProductsUseCase() {
  const repository = new PrismaProductReadRepository();

  const useCase = new ListProductsUseCase(repository);

  return useCase;
}
