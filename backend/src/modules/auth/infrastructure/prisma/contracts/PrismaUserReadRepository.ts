import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserDTO } from "@auth/application/dto/UserDTO";
import { UserRole } from "@auth/domain/enums/UserRole";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaUserReadRepository implements UserReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<UserDTO[]>> {
    const paginationOptions = buildPagination(pagination);

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.user.count(),
    ]);
    const dt = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: UserRole[user.role],
      createdAt: user.createdAt,
    }));
    return buildPaginatedResult(dt, total, pagination);
  }
}
