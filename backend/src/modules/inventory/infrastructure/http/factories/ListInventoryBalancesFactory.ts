import { ListInventoryBalancesUseCase } from "@inventory/application/useCases/queries/ListInventoryBalancesUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeListInventoryBalancesUseCase() {
  return new ListInventoryBalancesUseCase(new PrismaInventoryReadRepository());
}
