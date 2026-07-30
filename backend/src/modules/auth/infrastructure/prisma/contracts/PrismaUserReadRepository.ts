import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaUserReadRepository implements UserReadRepository {
  async list(pagination: PaginationRequest) {
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
    const dt = users.map((user) => UserReadMapper.toDTO(user));
    return buildPaginatedResult(dt, total, pagination);
  }
}
