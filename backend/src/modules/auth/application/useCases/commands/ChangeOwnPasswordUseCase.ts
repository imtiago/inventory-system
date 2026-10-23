import { BusinessRuleError, NotFoundError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IChangeOwnPasswordInput } from "@auth/application/dto/UserDTO";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

/** Troca da própria senha: exige a senha atual. */
export class ChangeOwnPasswordUseCase extends TransactionalUseCase<IChangeOwnPasswordInput, void> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ userId, currentPassword, newPassword }: IChangeOwnPasswordInput): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");

    const matches = await this.passwordHasher.compare(currentPassword, user.password);
    if (!matches) {
      throw new BusinessRuleError("A senha atual está incorreta.", "INVALID_CURRENT_PASSWORD");
    }

    user.changePassword(await this.passwordHasher.hash(newPassword));
    await this.userRepo.update(user);
  }
}
