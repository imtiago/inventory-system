import { BusinessRuleError, NotFoundError, TooManyRequestsError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IChangeOwnPasswordInput } from "@auth/application/dto/UserDTO";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { ILoginAttemptLimiter } from "@auth/application/ports/LoginAttemptLimiter";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export function passwordChangeAttemptKey(userId: string): string {
  return `pwd:${userId}`;
}

/** Troca da própria senha: exige a senha atual (tentativas limitadas por usuário). */
export class ChangeOwnPasswordUseCase extends TransactionalUseCase<IChangeOwnPasswordInput, void> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    transactionManager: TransactionManager,
    private readonly attemptLimiter: ILoginAttemptLimiter,
  ) {
    super(transactionManager);
  }

  protected async handle({ userId, currentPassword, newPassword }: IChangeOwnPasswordInput): Promise<void> {
    const key = passwordChangeAttemptKey(userId);
    // Checa e conta antes de qualquer await (atômico no event loop).
    if (!this.attemptLimiter.tryConsume(key)) {
      throw new TooManyRequestsError();
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");

    const matches = await this.passwordHasher.compare(currentPassword, user.password);
    if (!matches) {
      throw new BusinessRuleError("A senha atual está incorreta.", "INVALID_CURRENT_PASSWORD");
    }

    // Grava só a senha: não reverte uma desativação/rebaixamento concorrente.
    await this.userRepo.updatePassword(userId, await this.passwordHasher.hash(newPassword));
    this.attemptLimiter.clear(key);
  }
}
