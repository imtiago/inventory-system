import { BusinessRuleError, ConflictError, ErrorCodes, InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { PaymentMethod } from "../enums/PaymentMethod";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class Payment extends BaseEntity {
  private readonly _parcelId: string;
  private readonly _reference: string | null;
  private readonly _amountCents: number;
  private readonly _method: PaymentMethod;
  /** Data do pagamento ("YYYY-MM-DD", data de negócio). */
  private readonly _paymentDate: string;
  private readonly _createdById: string | null;
  /** Pago no fechamento da venda (estorno automático no cancelamento). */
  private readonly _atCheckout: boolean;
  /** Encargos de atraso cobrados neste pagamento (centavos); `amountCents` = principal abatido. */
  private readonly _fineCents: number;
  private readonly _interestCents: number;
  /** Parte dos encargos dispensada (≤ multa + juros), com motivo e autor. */
  private readonly _waivedCents: number;
  private readonly _waiverReason: string | null;
  private readonly _waivedById: string | null;

  private _reversedAt: Date | null;
  private _reversedById: string | null;
  private _reversalReason: string | null;

  constructor(props: {
    id?: string;
    parcelId: string;
    amountCents: number;
    method: PaymentMethod;
    reference: string | null;
    paymentDate: string;
    createdById?: string | null;
    atCheckout?: boolean;
    fineCents?: number;
    interestCents?: number;
    waivedCents?: number;
    waiverReason?: string | null;
    waivedById?: string | null;
    createdAt?: Date;
    reversedAt?: Date | null;
    reversedById?: string | null;
    reversalReason?: string | null;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    if (!Number.isInteger(props.amountCents) || props.amountCents <= 0) {
      throw new BusinessRuleError("O valor do pagamento deve ser maior que zero.", ErrorCodes.INVALID_PAYMENT_AMOUNT);
    }
    const fineCents = props.fineCents ?? 0;
    const interestCents = props.interestCents ?? 0;
    const waivedCents = props.waivedCents ?? 0;
    for (const [name, value] of [["fineCents", fineCents], ["interestCents", interestCents], ["waivedCents", waivedCents]] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw new InternalInvariantError(`Pagamento com ${name} inválido: ${value}.`, InternalErrorCodes.INVALID_PAYMENT_FEES);
      }
    }
    if (waivedCents > fineCents + interestCents) {
      throw new BusinessRuleError(
        "A dispensa não pode ser maior que a multa e os juros do pagamento.",
        ErrorCodes.WAIVER_EXCEEDS_FEES,
      );
    }
    const waiverReason = props.waiverReason?.trim() || null;
    if (waivedCents > 0 && !waiverReason) {
      throw new InternalInvariantError("Dispensa de encargos sem motivo.", InternalErrorCodes.INVALID_PAYMENT_FEES);
    }
    this._fineCents = fineCents;
    this._interestCents = interestCents;
    this._waivedCents = waivedCents;
    this._waiverReason = waivedCents > 0 ? waiverReason : null;
    this._waivedById = waivedCents > 0 ? (props.waivedById ?? null) : null;
    this._parcelId = props.parcelId;
    this._amountCents = props.amountCents;
    this._method = props.method;
    this._reference = props.reference;
    this._paymentDate = props.paymentDate;
    this._createdById = props.createdById ?? null;
    this._atCheckout = props.atCheckout ?? false;
    this._reversedAt = props.reversedAt ?? null;
    this._reversedById = props.reversedById ?? null;
    this._reversalReason = props.reversalReason ?? null;
  }

  get parcelId() {
    return this._parcelId;
  }

  get amountCents() {
    return this._amountCents;
  }

  get method() {
    return this._method;
  }

  get paymentDate() {
    return this._paymentDate;
  }

  get reference() {
    return this._reference;
  }

  get createdById() {
    return this._createdById;
  }

  get atCheckout() {
    return this._atCheckout;
  }

  get fineCents() {
    return this._fineCents;
  }

  get interestCents() {
    return this._interestCents;
  }

  get waivedCents() {
    return this._waivedCents;
  }

  get waiverReason() {
    return this._waiverReason;
  }

  get waivedById() {
    return this._waivedById;
  }

  /** Recebido em caixa = principal + multa + juros − dispensa. */
  get receivedCents(): number {
    return this._amountCents + this._fineCents + this._interestCents - this._waivedCents;
  }

  get reversedAt() {
    return this._reversedAt;
  }

  get reversedById() {
    return this._reversedById;
  }

  get reversalReason() {
    return this._reversalReason;
  }

  get isReversed(): boolean {
    return this._reversedAt !== null;
  }

  /** Estorna o pagamento (deixa de contar no pago). Já estornado → 409. */
  reverse(userId: string | null, reason: string, now: Date = new Date()): void {
    if (this.isReversed) {
      throw new ConflictError("Pagamento já estornado.", ErrorCodes.PAYMENT_ALREADY_REVERSED);
    }
    this._reversedAt = now;
    this._reversedById = userId;
    this._reversalReason = reason;
  }
}
