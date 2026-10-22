import { GetInventoryByIdReadUseCase } from "@inventory/application/useCases/queries/GetInventoryByIdReadUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByIdUseCase() {
  return new GetInventoryByIdReadUseCase(new PrismaInventoryReadRepository());
}
