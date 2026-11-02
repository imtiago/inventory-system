import { ConflictError, ErrorCodes } from "@shared/domain/errors";

export type ApprovalRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SaleCancelRequestProps {
  id: string;
  saleId: string;
  reason: string;
  status: ApprovalRequestStatus;
  requestedById: string | null;
  requestedAt: Date;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

/** Pedido de cancelamento de venda: o vendedor pede, o ADMIN aprova ou recusa. */
export class SaleCancelRequest {
  constructor(private readonly props: SaleCancelRequestProps) {}

  get id() {
    return this.props.id;
  }
  get saleId() {
    return this.props.saleId;
  }
  get status() {
    return this.props.status;
  }

  private assertPending() {
    if (this.props.status !== "PENDING") {
      throw new ConflictError("Este pedido de cancelamento já foi decidido.", ErrorCodes.CANCEL_REQUEST_NOT_PENDING);
    }
  }

  reject(decidedById: string, decisionReason: string, now: Date = new Date()) {
    this.assertPending();
    Object.assign(this.props, { status: "REJECTED", decidedById, decidedAt: now, decisionReason });
  }

  /** Só valida: o cancelamento da venda fecha o pedido como APROVADO. */
  assertCanBeApproved() {
    this.assertPending();
  }

  toProps(): Readonly<SaleCancelRequestProps> {
    return this.props;
  }
}
