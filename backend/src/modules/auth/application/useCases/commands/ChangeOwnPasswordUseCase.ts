import { BusinessRuleError, NotFoundError, TooManyRequestsError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IChangeOwnPasswordInput, IChangeOwnPasswordResult } from "@auth/application/dto/UserDTO";
import { ITokenService } from "@auth/application/ports/ITokenService";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { ILoginAttemptLimiter } from "@auth/application/ports/LoginAttemptLimiter";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export function passwordChangeAttemptKey(userId: string): string {
  return `pwd:${userId}`;
}

/**
 * Troca da própria senha: exige a senha atual (tentativas limitadas por usuário).
 * Derruba as outras sessões (passwordChangedAt) e devolve um token novo para a atual.
 */
export class ChangeOwnPasswordUseCase extends TransactionalUseCase<IChangeOwnPasswordInput, IChangeOwnPasswordResult> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    transactionManager: TransactionManager,
    private readonly attemptLimiter: ILoginAttemptLimiter,
    private readonly tokenService: ITokenService,
  ) {
    super(transactionManager);
  }

  protected async handle({ userId, currentPassword, newPassword }: IChangeOwnPasswordInput): Promise<IChangeOwnPasswordResult> {
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
    const passwordHash = await this.passwordHasher.hash(newPassword);
    // Assinado depois de gravar passwordChangedAt: o iat (segundos) nunca fica antes dele.
    await this.userRepo.updatePassword(userId, passwordHash, new Date());
    this.attemptLimiter.clear(key);

    const token = await this.tokenService.sign({ sub: user.id, role: user.role });
    return { token };
  }
}
