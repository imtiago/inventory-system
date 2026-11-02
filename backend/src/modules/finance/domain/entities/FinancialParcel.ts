import { Payment } from "./Payment";
import { ParcelStatus } from "../enums/ParcelStatus";
import { FinancialStatus } from "../enums/FinancialStatus";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { parcelStatus, remainingCents } from "../services/receivableStatus";

export class FinancialParcel extends BaseEntity {
  private readonly _financialDocumentId: string;
  private _amountCents: number;
  /** Vencimento "YYYY-MM-DD". */
  private _dueDate: string;
  /** Vencimento "a combinar" (caderninho): nunca fica vencida. */
  private _dueDateUnknown: boolean;
  private readonly _payments: Payment[];

  constructor(props: {
    id?: string;
    amountCents: number;
    dueDate: string;
    dueDateUnknown?: boolean;
    financialDocumentId: string;
    payments?: Payment[];
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._amountCents = props.amountCents;
    this._dueDate = props.dueDate;
    this._dueDateUnknown = props.dueDateUnknown ?? false;
    this._financialDocumentId = props.financialDocumentId;
    this._payments = props.payments ?? [];
  }

  get amountCents() {
    return this._amountCents;
  }

  get dueDate() {
    return this._dueDate;
  }

  get dueDateUnknown(): boolean {
    return this._dueDateUnknown;
  }

  get financialDocumentId() {
    return this._financialDocumentId;
  }

  get payments(): readonly Payment[] {
    return this._payments;
  }

  /** Soma dos pagamentos não estornados. */
  get paidCents(): number {
    return this._payments.reduce((total, p) => (p.isReversed ? total : total + p.amountCents), 0);
  }

  get remainingCents(): number {
    return remainingCents(this);
  }

  isPaid(): boolean {
    return this.paidCents >= this._amountCents;
  }

  /** Status na data de negócio `today`; documento CANCELED → CANCELED. */
  status(today: string, documentStatus: FinancialStatus = FinancialStatus.OPEN): ParcelStatus {
    return parcelStatus(
      {
        amountCents: this._amountCents,
        paidCents: this.paidCents,
        dueDate: this._dueDate,
        dueDateUnknown: this._dueDateUnknown,
        documentStatus,
      },
      today,
    );
  }

  /** Reescreve valor e vencimento (parcelamento do saldo "a combinar"); a parcela passa a ter data. */
  redefine(amountCents: number, dueDate: string): void {
    this._amountCents = amountCents;
    this._dueDate = dueDate;
    this._dueDateUnknown = false;
  }

  /** Tem pagamento gravado, inclusive estornado (a linha não pode ser apagada). */
  get hasAnyPayment(): boolean {
    return this._payments.length > 0;
  }

  addPayment(payment: Payment): void {
    this._payments.push(payment);
  }
}
