import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserDTO } from "@auth/application/dto/UserDTO";
import { UserRole } from "@auth/domain/enums/UserRole";
import { prisma } from "@shared/prisma";

export class PrismaUserReadRepository implements UserReadRepository {
  async list(): Promise<UserDTO[]> {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "asc",
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: UserRole[user.role],
      createdAt: user.createdAt,
    }));
  }
}
