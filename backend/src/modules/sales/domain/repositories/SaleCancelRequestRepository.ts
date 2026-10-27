import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { SaleCancelRequestDTO } from "@sales/application/dto/SaleCancelRequestDTO";
import { ApprovalRequestStatus, SaleCancelRequest } from "../entities/SaleCancelRequest";

export interface SaleCancelRequestRepository {
  /** Insere PENDING; violação do único parcial → 409 CANCEL_REQUEST_ALREADY_PENDING. */
  create(input: { saleId: string; reason: string; requestedById: string }): Promise<string>;
  /** Trava o pedido (FOR UPDATE) e o lê. Exige transação. */
  lockById(id: string): Promise<SaleCancelRequest | null>;
  /** Trava o pedido pendente da venda, se houver (antes da trava da venda). Exige transação. */
  lockPendingBySaleId(saleId: string): Promise<void>;
  hasPendingForSale(saleId: string): Promise<boolean>;
  /** Pagamento ativo (não estornado) em qualquer documento da venda. */
  saleHasActivePayments(saleId: string): Promise<boolean>;
  /** Grava a decisão (recusa). */
  saveDecision(request: SaleCancelRequest): Promise<void>;
  /** Fecha como APPROVED o pedido pendente da venda (cancelamento direto ou aprovação). */
  approvePendingForSale(saleId: string, decidedById: string | undefined): Promise<void>;
  findDtoById(id: string): Promise<SaleCancelRequestDTO | null>;
  list(
    pagination: PaginationRequest,
    filter: { status?: ApprovalRequestStatus },
  ): Promise<PaginatedResult<SaleCancelRequestDTO>>;
  countPending(): Promise<number>;
}
