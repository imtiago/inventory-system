import { GetUserByIdUseCase } from "@auth/application/useCases/queries/GetUserByIdUseCase";
import { PrismaUserReadRepository } from "@auth/infrastructure/prisma/contracts/PrismaUserReadRepository";
export function makeGetUserByIdUseCase() {
  const repository = new PrismaUserReadRepository();

  return new GetUserByIdUseCase(repository);
}
