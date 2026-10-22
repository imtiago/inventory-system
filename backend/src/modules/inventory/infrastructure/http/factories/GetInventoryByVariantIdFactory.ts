import { GetInventoryByVariantIdUseCase } from "@inventory/application/useCases/queries/GetInventoryByVariantIdUseCase";
import { PrismaInventoryReadRepository } from "@inventory/infrastructure/prisma/contracts/PrismaInventoryReadRepository";

export function makeGetInventoryByVariantId() {
  return new GetInventoryByVariantIdUseCase(new PrismaInventoryReadRepository());
}
