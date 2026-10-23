import { ConflictError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { ICreateUserInput, UserDTO } from "@auth/application/dto/UserDTO";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { User } from "@auth/domain/entities/User";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { normalizeEmail } from "@auth/domain/services/normalizeEmail";

export class CreateUserUseCase extends TransactionalUseCase<
  ICreateUserInput,
  UserDTO
> {
  constructor(
    private userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    { email, password, name, role }: ICreateUserInput,
  ): Promise<UserDTO> {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) throw new ConflictError("E-mail já está em uso.", "EMAIL_ALREADY_IN_USE");

    const hashedPassword = await this.passwordHasher.hash(password);

    const user = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });

    const created = await this.userRepo.create(user);

    return UserReadMapper.fromEntity(created);
  }
}
