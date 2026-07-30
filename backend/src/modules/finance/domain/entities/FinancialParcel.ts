import { Payment } from "./Payment";
import { ParcelStatus } from "../enums/ParcelStatus";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class FinancialParcel extends BaseEntity {
  private _financialDocumentId: string;
  private _amount: number;
  private _dueDate: Date;

  private _payments: Payment[];

  // private _paidAt: Date | null;

  constructor(props: {
    id?: string;
    amount: number;
    dueDate: Date;
    financialDocumentId: string;
    payments?: Payment[];
    createdAt?: Date;

    // paidAt?: Date | null;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._amount = props.amount;

    this._dueDate = props.dueDate;
    this._financialDocumentId = props.financialDocumentId;
    this._payments = props.payments ?? [];

    // this._paidAt = props.paidAt ?? null;
  }

  get amount() {
    return this._amount;
  }

  get dueDate() {
    return this._dueDate;
  }
  get financialDocumentId() {
    return this._financialDocumentId;
  }

  get paidAmount() {
    return this._payments.reduce((total, payment) => total + payment.amount, 0);
  }

  get remainingAmount() {
    return this.amount - this.paidAmount;
  }

  get payments() {
    return this._payments;
  }

  isPaid(): boolean {
    return this.paidAmount >= this.amount;
  }

  isOverdue(): boolean {
    return !this.isPaid() && new Date() > this.dueDate;
  }

  get status() {
    if (this.isPaid()) return ParcelStatus.PAID;

    if (this.paidAmount > 0) return ParcelStatus.PARTIALLY_PAID;

    if (this.isOverdue()) return ParcelStatus.OVERDUE;

    return ParcelStatus.OPEN;
  }

  // get paidAt() {
  //   return this._paidAt;
  // }

  // pay(): void {
  //   this._paidAt = new Date();
  // }
}
