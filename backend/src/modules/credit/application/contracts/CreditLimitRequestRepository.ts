import type { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import type { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import type { CreditLimitRequest, CreditRequestStatus } from "@credit/domain/creditLimitRequest";
import type { CreditLimitRequestDTO } from "@credit/application/dto/CreditLimitRequestDTO";

/**
 * Pedidos de aumento de limite. Ordem de travas: pedido (`lockById`, FOR UPDATE) → ficha do cliente
 * (`CustomerCreditService.applyChange`). Criar pedido trava só o cliente e insere (único parcial: um PENDING
 * por cliente; violação → 409 CREDIT_REQUEST_ALREADY_PENDING).
 */
export interface CreditLimitRequestRepository {
  create(input: {
    customerId: string;
    currentLimitCents: number;
    requestedLimitCents: number;
    reason: string;
    requestedById: string;
    /** Aprovação automática: nasce APPROVED, sem decisor. */
    autoApproved: boolean;
  }): Promise<string>;
  /** Trava o pedido (exige transação) e o lê. */
  lockById(id: string): Promise<CreditLimitRequest | null>;
  hasPendingForCustomer(customerId: string): Promise<boolean>;
  saveDecision(request: CreditLimitRequest): Promise<void>;
  findDtoById(id: string): Promise<CreditLimitRequestDTO | null>;
  list(pagination: PaginationRequest, filter: { status?: CreditRequestStatus }): Promise<PaginatedResult<CreditLimitRequestDTO>>;
  countPending(): Promise<number>;
}
