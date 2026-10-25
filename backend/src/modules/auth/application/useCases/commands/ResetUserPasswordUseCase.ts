import { NotFoundError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IResetUserPasswordInput } from "@auth/application/dto/UserDTO";
import { IPasswordHasher } from "@auth/application/ports/PasswordHasher";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

/** Redefinição de senha de qualquer usuário pelo administrador. */
export class ResetUserPasswordUseCase extends TransactionalUseCase<IResetUserPasswordInput, void> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: IPasswordHasher,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, password }: IResetUserPasswordInput): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");

    // Grava só a senha: não reverte uma desativação/rebaixamento concorrente.
    // passwordChangedAt derruba as sessões abertas do usuário.
    const passwordHash = await this.passwordHasher.hash(password);
    await this.userRepo.updatePassword(id, passwordHash, new Date());
  }
}
