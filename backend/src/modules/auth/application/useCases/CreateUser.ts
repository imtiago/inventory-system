import { UserRepository } from "../../domain/repositories/UserRepository";
import { User } from "../../domain/entities/User";
import { hash } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { UserRole } from "@prisma/client";

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export class CreateUser {
  constructor(private userRepo: UserRepository) {}

  async execute(data: CreateUserRequest): Promise<User> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new Error("E-mail already in use");

    const hashedPassword = await hash(data.password, 10);

    const user: User = {
      id: uuid(),
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role ?? UserRole.VENDEDOR,
      createdAt: new Date(),
    };

    return this.userRepo.create(user);
  }
}
