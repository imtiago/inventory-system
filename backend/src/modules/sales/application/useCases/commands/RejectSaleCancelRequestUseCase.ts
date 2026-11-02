import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";
import { SaleCancelRequestDTO } from "@sales/application/dto/SaleCancelRequestDTO";
import { IDecideSaleCancelRequestInput } from "./ApproveSaleCancelRequestUseCase";

/** ADMIN recusa (motivo obrigatório): trava o pedido → valida PENDING → REJECTED. A venda não muda. */
export class RejectSaleCancelRequestUseCase extends TransactionalUseCase<IDecideSaleCancelRequestInput, SaleCancelRequestDTO> {
  constructor(
    private readonly requests: SaleCancelRequestRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, userId, reason }: IDecideSaleCancelRequestInput): Promise<SaleCancelRequestDTO> {
    const request = await this.requests.lockById(id);
    if (!request) throw new NotFoundError("Pedido de cancelamento não encontrado.", ErrorCodes.CANCEL_REQUEST_NOT_FOUND);
    request.reject(userId, reason ?? "");
    await this.requests.saveDecision(request);
    const dto = await this.requests.findDtoById(id);
    if (!dto) throw new NotFoundError("Pedido de cancelamento não encontrado.", ErrorCodes.CANCEL_REQUEST_NOT_FOUND);
    return dto;
  }
}
