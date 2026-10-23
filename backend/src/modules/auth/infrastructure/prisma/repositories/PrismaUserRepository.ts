import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { User } from "@auth/domain/entities/User";
import { UserMapper } from "../mappers/UserMapper";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export class PrismaUserRepository implements UserRepository {

  async create(user: User): Promise<User> {
    const created = await getDb().user.create({
      data: UserMapper.toCreatePersistence(user),
    });

    return UserMapper.toDomain(created);
  }

  async update(entity: User): Promise<User> {
    const created = await getDb().user.update({
      where: { id: entity.id },
      data: UserMapper.toUpdatePersistence(entity),
    });

    return UserMapper.toDomain(created);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await getDb().user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await getDb().user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async delete(id: string): Promise<void> {
    await getDb().user.delete({
      where: { id },
    });
  }

  async countActiveAdminsExcluding(id: string): Promise<number> {
    // FOR UPDATE: dentro de uma transação, trava as linhas dos admins ativos até
    // o commit. Uma segunda transação que tente o mesmo espera e, ao seguir,
    // reavalia o WHERE (READ COMMITTED) e já não vê o admin rebaixado/desativado.
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "users"
      WHERE "role" = 'ADMIN' AND "active" = true
      FOR UPDATE
    `;
    return rows.filter((row) => row.id !== id).length;
  }
}
