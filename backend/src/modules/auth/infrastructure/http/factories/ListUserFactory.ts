import { ListUsers } from "@auth/application/useCases/ListUsers";
import { PrismaUserReadRepository } from "@auth/infrastructure/prisma/contracts/PrismaUserReadRepository";
export function makeListUserUseCase() {
  const repository = new PrismaUserReadRepository();

  return new ListUsers(repository);
}
