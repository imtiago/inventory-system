import { ListUsers } from "@auth/application/useCases/queries/ListUsersUseCase";
import { PrismaUserReadRepository } from "@auth/infrastructure/prisma/contracts/PrismaUserReadRepository";
export function makeListUserUseCase() {
  const repository = new PrismaUserReadRepository();

  return new ListUsers(repository);
}
