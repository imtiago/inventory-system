import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { IUpdateUserInput, UserDTO } from "@auth/application/dto/UserDTO";
import { UserReadMapper } from "@auth/application/mappers/UserReadMapper";
import { UserRole } from "@auth/domain/enums/UserRole";
import { UserAccessChanges, UserRepository } from "@auth/domain/repositories/UserRepository";

export class UpdateUserUseCase extends TransactionalUseCase<IUpdateUserInput, UserDTO> {
  constructor(
    private readonly userRepo: UserRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ actorId, id, name, role, active }: IUpdateUserInput): Promise<UserDTO> {
    // Só um pedido que desativa ou define papel não-ADMIN pode tirar um admin.
    // Nesse caso trava primeiro os admins ativos (ordem de id) e depois o alvo:
    // ordem fixa de locks, sem deadlock entre dois rebaixamentos concorrentes.
    const mayRemoveAdmin = active === false || (role !== undefined && role !== UserRole.ADMIN);
    const otherActiveAdmins = mayRemoveAdmin
      ? await this.userRepo.countActiveAdminsExcluding(id)
      : undefined;

    // Linha do alvo travada até o commit: as regras abaixo valem sobre o estado atual.
    const user = await this.userRepo.findByIdForUpdate(id);
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
    if (wasActiveAdmin && !staysActiveAdmin && otherActiveAdmins === 0) {
      throw new ConflictError(
        "O sistema precisa de ao menos um administrador ativo.",
        "LAST_ADMIN",
      );
    }

    const changes: UserAccessChanges = {};
    if (name !== undefined) changes.name = name;
    if (role !== undefined) changes.role = role;
    if (active !== undefined) changes.active = active;

    const saved = await this.userRepo.updateAccess(id, changes);
    return UserReadMapper.fromEntity(saved);
  }
}
