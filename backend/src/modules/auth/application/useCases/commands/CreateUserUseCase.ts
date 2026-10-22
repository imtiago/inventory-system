import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { ICreateUserInput, IUserOutput } from "@auth/application/dto/UserDTO";
import { User } from "@auth/domain/entities/User";
import { UserRepository } from "@auth/domain/repositories/UserRepository";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";

export class CreateUserUseCase extends TransactionalUseCase<
  ICreateUserInput,
  IUserOutput
> {
  constructor(
    private userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    { email, password, name, role }: ICreateUserInput,
  ): Promise<IUserOutput> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new Error("E-mail already in use");

    const hashedPassword = await this.passwordHasher.hash(password);

    const userCode = await this.numberGenerator.generate(
      NumberRangeName.USER,
      "U",
    );

    const user = new User({
      name,
      code: userCode,
      email,
      password: hashedPassword,
      role,
    });

    await this.userRepo.create(user);

    return {
      id: user.id,
      code: user.code,
      name: user.name,
      role: user.role,
      email: user.email,
    };
  }
}
