import { GetUserById } from "@auth/application/useCases/GetUserById";
import { PrismaUserReadRepository } from "@auth/infrastructure/prisma/contracts/PrismaUserReadRepository";
export function makeGetUserByIdUseCase() {
  const repository = new PrismaUserReadRepository();

  return new GetUserById(repository);
}
