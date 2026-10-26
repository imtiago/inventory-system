import { Prisma } from "@prisma/client";
import { UserReadRepository } from "@auth/application/contracts/UserReadRepository";
import { IListUsersInput, UserDTO } from "@auth/application/dto/UserDTO";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { containsLiteral } from "@shared/infrastructure/database/literalSearch";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

// Nunca seleciona a senha.
const USER_DTO_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export class PrismaUserReadRepository implements UserReadRepository {
  async list({ page, limit, search }: IListUsersInput) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: containsLiteral(search) },
            { email: containsLiteral(search) },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      getDb().user.findMany({
        where,
        select: USER_DTO_SELECT,
        ...buildPagination({ page, limit }),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      getDb().user.count({ where }),
    ]);
    return buildPaginatedResult(users.map(UserReadMapper.toDTO), total, { page, limit });
  }

  async findById(id: string): Promise<UserDTO | null> {
    const user = await getDb().user.findUnique({ where: { id }, select: USER_DTO_SELECT });
    return user ? UserReadMapper.toDTO(user) : null;
  }
}
