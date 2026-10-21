import { UserRepository } from "../../domain/repositories/UserRepository";
import { User } from "../../domain/entities/User";
import { hash } from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { ICreateUserInput } from "@auth/application/dto/UserDTO";

export class CreateUserUseCase extends TransactionalUseCase<
  ICreateUserInput,
  User
> {
  constructor(
    private userRepo: UserRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateUserInput,
    tx: Prisma.TransactionClient,
  ): Promise<User> {
    const existing = await this.userRepo.findByEmail(request.email);
    if (existing) throw new Error("E-mail already in use");

    const hashedPassword = await hash(request.password, 10);

    const user = new User({
      name: request.name,
      email: request.email,
      password: hashedPassword,
      role: request.role,
    });
    return this.userRepo.create(user);
  }
}
