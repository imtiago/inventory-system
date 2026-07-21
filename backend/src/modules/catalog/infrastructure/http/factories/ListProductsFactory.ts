import { PrismaProductReadRepository } from "../../prisma/contracts/PrismaProductReadRepository";
import { ListProductsUseCase } from "../../../application/useCases/ListProductsUseCase";

export function makeListProductsUseCase() {
  const repository = new PrismaProductReadRepository();

  const useCase = new ListProductsUseCase(repository);

  return useCase;
}
