import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";
import { SaleCancelRequestDTO } from "@sales/application/dto/SaleCancelRequestDTO";
import { CancelSaleUseCase } from "./CancelSaleUseCase";

export interface IDecideSaleCancelRequestInput {
  id: string;
  userId: string;
  reason?: string;
}

/**
 * ADMIN aprova: trava o pedido → valida PENDING → CancelSaleUseCase aninhado (venda →
 * documento a receber → estoque; fecha o pedido como APPROVED). Pagamento surgido depois
 * do pedido → 409 SALE_HAS_PAYMENTS e tudo volta (o pedido continua PENDING).
 */
export class ApproveSaleCancelRequestUseCase extends TransactionalUseCase<IDecideSaleCancelRequestInput, SaleCancelRequestDTO> {
  constructor(
    private readonly requests: SaleCancelRequestRepository,
    private readonly cancelSale: CancelSaleUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, userId }: IDecideSaleCancelRequestInput): Promise<SaleCancelRequestDTO> {
    const request = await this.requests.lockById(id);
    if (!request) throw new NotFoundError("Pedido de cancelamento não encontrado.", ErrorCodes.CANCEL_REQUEST_NOT_FOUND);
    request.assertCanBeApproved();

    await this.cancelSale.execute({ id: request.saleId, userId });

    const dto = await this.requests.findDtoById(id);
    if (!dto) throw new NotFoundError("Pedido de cancelamento não encontrado.", ErrorCodes.CANCEL_REQUEST_NOT_FOUND);
    return dto;
  }
}
