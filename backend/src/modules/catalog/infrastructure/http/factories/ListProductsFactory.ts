import { PrismaProductReadRepository } from "../../prisma/contracts/PrismaProductVariantReadRepository";
import { ListProductsUseCase } from "../../../application/useCases/ListProductsUseCase";

export function makeListProductsUseCase() {
  const repository = new PrismaProductReadRepository();

  const useCase = new ListProductsUseCase(repository);

  return useCase;
}
