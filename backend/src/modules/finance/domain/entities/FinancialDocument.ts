import { FinancialType } from "../enums/FinancialType";
import { FINANCIAL_TYPE_LABEL } from "../enums/financialTypeLabels";
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
import { fromCents } from "@shared/domain/money";

export interface RegisterPaymentProps {
  parcelId: string;
  amountCents: number;
  method: PaymentMethod;
  /** "YYYY-MM-DD" (data de negócio). */
  paymentDate: string;
  reference: string | null;
  createdById: string;
  /** Pago no fechamento da venda. */
  atCheckout?: boolean;
  /** Encargos de atraso cobrados neste pagamento (centavos). */
  fineCents?: number;
  interestCents?: number;
  /** Dispensa (≤ multa + juros), com motivo; autor = `createdById`. */
  waivedCents?: number;
  waiverReason?: string | null;
  /** Motivo da data passada (a receber, só quem aprova crédito). */
  backdateReason?: string | null;
}

export class FinancialDocument extends BaseEntity {
  private _type: FinancialType;
  private _originId: string;
  private _originType: FinancialOriginType;

  private _partyId: string;
  private _partyType: FinancialPartyType;

  private _status: FinancialStatus;

  /** Sem multa nem juros de atraso (vendas anteriores ao crediário, parcelado antigo, caderninho). */
  private readonly _noLateFees: boolean;

  private _parcels: FinancialParcel[];

  constructor(props: {
    id?: string;
    type: FinancialType;
    originId: string;
    originType: FinancialOriginType;

    status?: FinancialStatus;

    noLateFees?: boolean;

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
    this._noLateFees = props.noLateFees ?? false;
  }

  get noLateFees(): boolean {
    return this._noLateFees;
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
    const waived = (props.waivedCents ?? 0) > 0;
    const payment = new Payment({ ...props, parcelId: parcel.id, waivedById: waived ? props.createdById : null });
    parcel.addPayment(payment);
    this.recalculateStatus();
    return payment;
  }

  /** Estorna um pagamento de uma parcela deste documento e recalcula o status. */
  reversePayment(paymentId: string, userId: string | null, reason: string, now: Date = new Date()): Payment {
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
      throw new ConflictError(
        `${FINANCIAL_TYPE_LABEL[this._type]} cancelada.`,
        ErrorCodes.FINANCIAL_DOCUMENT_CANCELED,
      );
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

  /**
   * Parcela o saldo de uma parcela "a combinar" em parcelas com vencimento.
   * Sem pagamento algum: a parcela some (ou, se tem pagamento só estornado, vira a 1ª nova).
   * Com pagamento parcial: fica com o valor pago, vencimento `today`, quitada; o restante vira as novas.
   * Exige pagamentos carregados (documento lido sob trava).
   */
  splitUnknownDueParcel(
    parcelId: string,
    parts: { amountCents: number; dueDate: string }[],
    today: string,
  ): { closedParcel: FinancialParcel | null; removedParcelId: string | null; newParcels: FinancialParcel[] } {
    const parcel = this._parcels.find((p) => p.id === parcelId);
    if (!parcel) {
      throw new NotFoundError("Parcela não encontrada.", ErrorCodes.PARCEL_NOT_FOUND);
    }
    if (this._status === FinancialStatus.CANCELED || !parcel.dueDateUnknown) {
      throw new BusinessRuleError(
        "Só dá para parcelar o saldo de uma parcela com vencimento a combinar.",
        ErrorCodes.PARCEL_NOT_TO_BE_AGREED,
      );
    }
    const remaining = parcel.remainingCents;
    const sum = parts.reduce((t, p) => t + p.amountCents, 0);
    if (parts.length === 0 || sum !== remaining) {
      throw new BusinessRuleError(
        `A soma das parcelas deve ser igual ao saldo (R$ ${fromCents(remaining).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}).`,
        ErrorCodes.SPLIT_TOTAL_MISMATCH,
      );
    }
    parts.forEach((part, i) => {
      if (!Number.isInteger(part.amountCents) || part.amountCents <= 0) {
        throw new BusinessRuleError("O valor de cada parcela deve ser maior que zero.", ErrorCodes.SPLIT_DATES_INVALID);
      }
      if (part.dueDate < today) {
        throw new BusinessRuleError("O vencimento não pode ser anterior a hoje.", ErrorCodes.SPLIT_DATES_INVALID);
      }
      if (i > 0 && part.dueDate <= parts[i - 1].dueDate) {
        throw new BusinessRuleError(
          "Os vencimentos devem estar em ordem crescente, sem repetir a data.",
          ErrorCodes.SPLIT_DATES_INVALID,
        );
      }
    });

    const paid = parcel.paidCents;
    const make = (part: { amountCents: number; dueDate: string }) =>
      new FinancialParcel({
        amountCents: part.amountCents,
        dueDate: part.dueDate,
        financialDocumentId: this.id,
      });

    if (paid > 0) {
      parcel.redefine(paid, today);
      const newParcels = parts.map(make);
      newParcels.forEach((p) => this._parcels.push(p));
      this.recalculateStatus();
      return { closedParcel: parcel, removedParcelId: null, newParcels };
    }
    if (parcel.hasAnyPayment) {
      // Só pagamentos estornados: a linha fica (histórico) e vira a primeira parte.
      parcel.redefine(parts[0].amountCents, parts[0].dueDate);
      const newParcels = parts.slice(1).map(make);
      newParcels.forEach((p) => this._parcels.push(p));
      this.recalculateStatus();
      return { closedParcel: parcel, removedParcelId: null, newParcels };
    }
    this._parcels = this._parcels.filter((p) => p.id !== parcelId);
    const newParcels = parts.map(make);
    newParcels.forEach((p) => this._parcels.push(p));
    this.recalculateStatus();
    return { closedParcel: null, removedParcelId: parcelId, newParcels };
  }

  addParcel(parcel: FinancialParcel): void {
    this._parcels.push(parcel);
  }
}
