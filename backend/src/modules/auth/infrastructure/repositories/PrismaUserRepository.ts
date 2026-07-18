import { prisma } from "../../../../shared/prisma";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { User } from "../../domain/entities/User";
import { UserMapper } from "../mappers/UserMapper";

export class PrismaUserRepository implements UserRepository {
  async create(user: User): Promise<User> {
    const created = await prisma.user.create({
      data: UserMapper.toCreatePersistence(user),
    });

    return UserMapper.toDomain(created);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async list(page: number, limit: number): Promise<User[]> {
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip,
      take: limit,
    });

    return users.map(UserMapper.toDomain);
  }
}
