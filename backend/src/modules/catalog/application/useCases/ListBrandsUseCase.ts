import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductReadRepository";

export class ListBrandsUseCase {
  constructor(private readonly productQuery: PrismaProductReadRepository) {}

  async execute() {
    return this.productQuery.list();
  }
}
