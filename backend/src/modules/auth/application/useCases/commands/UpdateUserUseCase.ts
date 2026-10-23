import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IUpdateUserInput, UserDTO } from "@auth/application/dto/UserDTO";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UserRepository } from "@auth/domain/repositories/UserRepository";

export class UpdateUserUseCase extends TransactionalUseCase<IUpdateUserInput, UserDTO> {
  constructor(
    private readonly userRepo: UserRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ actorId, id, name, role, active }: IUpdateUserInput): Promise<UserDTO> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("Usuário não encontrado.", "USER_NOT_FOUND");

    const nextRole = role ?? user.role;
    const nextActive = active ?? user.active;

    if (actorId === id && (!nextActive || nextRole !== UserRole.ADMIN)) {
      throw new ConflictError(
        "Você não pode desativar a si mesmo nem remover o seu próprio papel de administrador.",
        "CANNOT_CHANGE_OWN_ACCESS",
      );
    }

    const wasActiveAdmin = user.active && user.role === UserRole.ADMIN;
    const staysActiveAdmin = nextActive && nextRole === UserRole.ADMIN;
    if (wasActiveAdmin && !staysActiveAdmin) {
      // Na mesma transação da gravação (as linhas dos admins ficam travadas).
      const otherAdmins = await this.userRepo.countActiveAdminsExcluding(id);
      if (otherAdmins === 0) {
        throw new ConflictError(
          "O sistema precisa de ao menos um administrador ativo.",
          "LAST_ADMIN",
        );
      }
    }

    if (name !== undefined) user.rename(name);
    if (role !== undefined) user.changeRole(role);
    if (active !== undefined) {
      if (active) user.activate();
      else user.deactivate();
    }

    const saved = await this.userRepo.update(user);
    return UserReadMapper.fromEntity(saved);
  }
}
