import { ConflictError, ErrorCodes } from "@shared/domain/errors";
import { assertNonNegativeInt } from "./creditInput";

export type CreditRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CreditLimitRequestProps {
  id: string;
  customerId: string;
  currentLimitCents: number;
  requestedLimitCents: number;
  approvedLimitCents: number | null;
  reason: string;
  status: CreditRequestStatus;
  autoApproved: boolean;
  requestedById: string | null;
  requestedAt: Date;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

/** Pedido de aumento de limite: o vendedor pede, quem tem `credit.approve` decide (ou aprovação automática). */
export class CreditLimitRequest {
  constructor(private readonly props: CreditLimitRequestProps) {}

  get id() {
    return this.props.id;
  }
  get customerId() {
    return this.props.customerId;
  }
  get requestedLimitCents() {
    return this.props.requestedLimitCents;
  }

  private assertPending() {
    if (this.props.status !== "PENDING") {
      throw new ConflictError("Este pedido de aumento já foi decidido.", ErrorCodes.CREDIT_REQUEST_NOT_PENDING);
    }
  }

  /** Valida PENDING e devolve o limite a aplicar (o ajustado, se houver, senão o pedido). */
  approve(decidedById: string, approvedLimitCents: number | undefined, decisionReason: string | null, now: Date = new Date()): number {
    this.assertPending();
    const limit = approvedLimitCents ?? this.props.requestedLimitCents;
    assertNonNegativeInt(limit, "approvedLimitCents");
    Object.assign(this.props, { status: "APPROVED", approvedLimitCents: limit, decidedById, decidedAt: now, decisionReason });
    return limit;
  }

  reject(decidedById: string, decisionReason: string, now: Date = new Date()) {
    this.assertPending();
    Object.assign(this.props, { status: "REJECTED", decidedById, decidedAt: now, decisionReason });
  }

  toProps(): Readonly<CreditLimitRequestProps> {
    return this.props;
  }
}
