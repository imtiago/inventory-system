import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";
import { SaleCancelRequestRepository } from "@sales/domain/repositories/SaleCancelRequestRepository";
import { SaleStatus } from "@sales/domain/enums/SaleStatus";
import { SaleCancelRequestDTO } from "@sales/application/dto/SaleCancelRequestDTO";
import { isWithinCheckoutRefundWindow } from "@sales/domain/services/checkoutRefundWindow";

export interface IRequestSaleCancelInput {
  saleId: string;
  reason: string;
  userId: string;
}

/**
 * Vendedor pede o cancelamento. Trava a venda (serializa pedidos simultâneos) → valida
 * (não cancelada, sem pagamento de parcela, pago no ato só até 7 dias, sem pedido em
 * aberto) → grava o pedido PENDING. A janela é conferida de novo na aprovação.
 */
export class RequestSaleCancelUseCase extends TransactionalUseCase<IRequestSaleCancelInput, SaleCancelRequestDTO> {
  constructor(
    private readonly sales: SaleRepository,
    private readonly requests: SaleCancelRequestRepository,
    transactionManager: TransactionManager,
    private readonly now: () => Date = () => new Date(),
  ) {
    super(transactionManager);
  }

  protected async handle({ saleId, reason, userId }: IRequestSaleCancelInput): Promise<SaleCancelRequestDTO> {
    const sale = await this.sales.lockById(saleId);
    if (!sale) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);
    if (sale.status === SaleStatus.CANCELED) {
      throw new ConflictError("Venda já cancelada.", ErrorCodes.SALE_ALREADY_CANCELED);
    }
    if (await this.requests.hasPendingForSale(saleId)) {
      throw new ConflictError(
        "Já existe um pedido de cancelamento em aberto para esta venda.",
        ErrorCodes.CANCEL_REQUEST_ALREADY_PENDING,
      );
    }
    const payments = await this.requests.saleActivePayments(saleId);
    if (payments.installment) {
      throw new ConflictError("Venda com pagamentos registrados não pode ser cancelada.", ErrorCodes.SALE_HAS_PAYMENTS);
    }
    if (payments.atCheckout && !isWithinCheckoutRefundWindow(sale.createdAt, this.now())) {
      throw new ConflictError(
        "Venda paga no ato só pode ser cancelada com estorno em até 7 dias.",
        ErrorCodes.CHECKOUT_REFUND_WINDOW_EXPIRED,
      );
    }

    const id = await this.requests.create({ saleId, reason, requestedById: userId });
    const dto = await this.requests.findDtoById(id);
    if (!dto) throw new NotFoundError("Pedido de cancelamento não encontrado.", ErrorCodes.CANCEL_REQUEST_NOT_FOUND);
    return dto;
  }
}
