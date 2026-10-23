import { BusinessRuleError, ConflictError, ErrorCodes } from "@shared/domain/errors";
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
    this._parcelId = props.parcelId;
    this._amountCents = props.amountCents;
    this._method = props.method;
    this._reference = props.reference;
    this._paymentDate = props.paymentDate;
    this._createdById = props.createdById ?? null;
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
  reverse(userId: string, reason: string, now: Date = new Date()): void {
    if (this.isReversed) {
      throw new ConflictError("Pagamento já estornado.", ErrorCodes.PAYMENT_ALREADY_REVERSED);
    }
    this._reversedAt = now;
    this._reversedById = userId;
    this._reversalReason = reason;
  }
}
