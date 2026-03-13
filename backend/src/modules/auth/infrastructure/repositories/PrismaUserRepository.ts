import { prisma } from "../../../../shared/prisma";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { User } from "../../domain/entities/User";

export class PrismaUserRepository implements UserRepository {
  async create(user: User): Promise<User> {
    const created = await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
    return created as unknown as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user as unknown as User | null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user as unknown as User | null;
  }

  async list(page: number, limit: number): Promise<User[]> {
    const skip = (page - 1) * limit;
    const users = await prisma.user.findMany({ skip, take: limit });
    return users as unknown as User[];
  }
}
