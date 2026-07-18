//src/modules/auth/infrastructure/mappers/UserMapper.ts

import { User } from "../../domain/entities/User";
import { User as PrismaUser, Prisma } from "@prisma/client";

export class UserMapper {
  static toDomain(prisma: PrismaUser): User {
    return new User({
      id: prisma.id,
      name: prisma.name,
      email: prisma.email,
      password: prisma.password,
      role: prisma.role ?? undefined,
      createdAt: prisma.createdAt,
    });
  }

  static toCreatePersistence(user: User): Prisma.UserCreateInput {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  static toUpdatePersistence(user: User): Prisma.UserUpdateInput {
    return {
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    };
  }
}
