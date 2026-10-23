import { FinancialType } from "../enums/FinancialType";
import { FinancialParcel } from "./FinancialParcel";
import { FinancialStatus } from "../enums/FinancialStatus";
import { FinancialPartyType } from "../enums/FinancialPartyType";
import { FinancialOriginType } from "../enums/FinancialOriginType";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import {
  BusinessRuleError,
  ConflictError,
  ErrorCodes,
  InternalErrorCodes,
  InternalInvariantError,
  NotFoundError,
} from "@shared/domain/errors";
import { ParcelStatus } from "../enums/ParcelStatus";
import { PaymentMethod } from "../enums/PaymentMethod";
import { documentStatusFor } from "../services/receivableStatus";
import { Payment } from "./Payment";

export interface RegisterPaymentProps {
  parcelId: string;
  amountCents: number;
  method: PaymentMethod;
  /** "YYYY-MM-DD" (data de negócio). */
  paymentDate: string;
  reference: string | null;
  createdById: string;
}

export class FinancialDocument extends BaseEntity {
  private _type: FinancialType;
  private _originId: string;
  private _originType: FinancialOriginType;

  private _partyId: string;
  private _partyType: FinancialPartyType;

  private _status: FinancialStatus;

  private _parcels: FinancialParcel[];

  constructor(props: {
    id?: string;
    type: FinancialType;
    originId: string;
    originType: FinancialOriginType;

    status?: FinancialStatus;

    partyId: string;
    partyType: FinancialPartyType;

    createdAt?: Date;

    parcels?: FinancialParcel[];
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._type = props.type;

    this._originId = props.originId;
    this._originType = props.originType;

    this._partyId = props.partyId;

    this._partyType = props.partyType;

    this._parcels = props.parcels ?? [];

    this._status = props.status ?? FinancialStatus.OPEN;
  }

  get type(): FinancialType {
    return this._type;
  }

  get partyId(): string {
    return this._partyId;
  }

  get partyType(): FinancialPartyType {
    return this._partyType;
  }

  get parcels(): FinancialParcel[] {
    return this._parcels;
  }

  get totalCents(): number {
    return this._parcels.reduce((total, parcel) => total + parcel.amountCents, 0);
  }

  get paidCents(): number {
    return this._parcels.reduce((total, parcel) => total + parcel.paidCents, 0);
  }

  get remainingCents(): number {
    return this._parcels.reduce((total, parcel) => total + parcel.remainingCents, 0);
  }

  /** Status da parcela considerando o documento (CANCELED → todas CANCELED). */
  parcelStatus(parcel: FinancialParcel, today: string): ParcelStatus {
    return parcel.status(today, this._status);
  }

  /** Recalcula o status a partir dos pagamentos ativos (exige parcelas com pagamentos carregados). */
  recalculateStatus(): void {
    this._status = documentStatusFor(this._status, this._parcels);
  }

  get status(): FinancialStatus {
    return this._status;
  }
  get originId(): string {
    return this._originId;
  }
  get originType(): FinancialOriginType {
    return this._originType;
  }

  /**
   * Registra um pagamento numa parcela deste documento e recalcula o status.
   * Exige parcelas com pagamentos carregados (documento lido sob trava).
   */
  registerPayment(props: RegisterPaymentProps): Payment {
    const parcel = this._parcels.find((p) => p.id === props.parcelId);
    if (!parcel) {
      throw new NotFoundError("Parcela não encontrada.", ErrorCodes.PARCEL_NOT_FOUND);
    }
    this.assertNotCanceled();
    if (props.amountCents > parcel.remainingCents) {
      throw new BusinessRuleError(
        "O valor do pagamento excede o restante da parcela.",
        ErrorCodes.PAYMENT_EXCEEDS_REMAINING,
      );
    }
    const payment = new Payment({ ...props, parcelId: parcel.id });
    parcel.addPayment(payment);
    this.recalculateStatus();
    return payment;
  }

  /** Estorna um pagamento de uma parcela deste documento e recalcula o status. */
  reversePayment(paymentId: string, userId: string, reason: string, now: Date = new Date()): Payment {
    const payment = this._parcels.flatMap((p) => p.payments).find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundError("Pagamento não encontrado.", ErrorCodes.PAYMENT_NOT_FOUND);
    }
    // Já estornado tem precedência (409 PAYMENT_ALREADY_REVERSED vem de payment.reverse).
    if (!payment.isReversed) this.assertNotCanceled();
    payment.reverse(userId, reason, now);
    this.recalculateStatus();
    return payment;
  }

  private assertNotCanceled(): void {
    if (this._status === FinancialStatus.CANCELED) {
      throw new ConflictError("Conta a receber cancelada.", ErrorCodes.FINANCIAL_DOCUMENT_CANCELED);
    }
  }

  /** Pagamentos são checados antes (SALE_HAS_PAYMENTS); aqui é só a invariante. */
  cancel(): void {
    if (this._status === FinancialStatus.PAID || this._status === FinancialStatus.CANCELED) {
      throw new InternalInvariantError(
        `Documento financeiro ${this._status} não pode ser cancelado.`,
        InternalErrorCodes.FINANCIAL_DOCUMENT_NOT_CANCELABLE,
      );
    }
    this._status = FinancialStatus.CANCELED;
  }

  addParcel(parcel: FinancialParcel): void {
    this._parcels.push(parcel);
  }
}
