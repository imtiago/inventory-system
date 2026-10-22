import { User } from "@auth/domain/entities/User";
import { UserMapper } from "../mappers/UserMapper";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { PrismaClient } from "@prisma/client";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: User): Promise<User> {
    const created = await this.prisma.user.create({
      data: UserMapper.toCreatePersistence(user),
    });

    return UserMapper.toDomain(created);
  }

  async update(entity: User): Promise<User> {
    const created = await this.prisma.user.update({
      where: { id: entity.id },
      data: UserMapper.toUpdatePersistence(entity),
    });

    return UserMapper.toDomain(created);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async list(page: number, limit: number): Promise<User[]> {
    const skip = (page - 1) * limit;

    const users = await this.prisma.user.findMany({
      skip,
      take: limit,
    });

    return users.map(UserMapper.toDomain);
  }
}
