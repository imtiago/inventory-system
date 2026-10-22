import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { UserDTO } from "@auth/application/dto/UserDTO";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaUserReadRepository implements UserReadRepository {
  async list(pagination: PaginationRequest) {
    const paginationOptions = buildPagination(pagination);

    const [users, total] = await Promise.all([
      getDb().user.findMany({
        ...paginationOptions,
        orderBy: {
          createdAt: "asc",
        },
      }),
      getDb().user.count(),
    ]);
    const dt = users.map((user) => UserReadMapper.toDTO(user));
    return buildPaginatedResult(dt, total, pagination);
  }

  async findById(id: string): Promise<UserDTO | null> {
    const user = await getDb().user.findUnique({
      where: {
        id,
      },
    });
    const dt = UserReadMapper.toDTO(user);
    return dt;
  }
}
