import { v4 as uuid } from "uuid";
import { ParcelStatus } from "../enums/ParcelStatus";
import { Payment } from "./Payment";

export class FinancialParcel {
  private _id: string;

  private _financialDocumentId: string;

  private _amount: number;

  private _dueDate: Date;

  private _status: ParcelStatus;

  private _payments: Payment[];

  constructor(props: {
    id?: string;
    financialDocumentId: string;
    amount: number;
    dueDate: Date;
    status?: ParcelStatus;
    payments?: Payment[];
  }) {
    if (props.amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }

    this._id = props.id ?? uuid();

    this._financialDocumentId = props.financialDocumentId;

    this._amount = props.amount;

    this._dueDate = props.dueDate;

    this._status = props.status ?? ParcelStatus.OPEN;

    this._payments = props.payments ?? [];
  }

  get id() {
    return this._id;
  }

  get financialDocumentId() {
    return this._financialDocumentId;
  }

  get amount() {
    return this._amount;
  }

  get dueDate() {
    return this._dueDate;
  }

  get status() {
    return this._status;
  }

  get payments() {
    return this._payments;
  }

  get paidAmount() {
    return this._payments.reduce((total, payment) => total + payment.amount, 0);
  }

  get remainingAmount() {
    return this._amount - this.paidAmount;
  }

  addPayment(payment: Payment) {
    this._payments.push(payment);

    if (this.remainingAmount <= 0) {
      this._status = ParcelStatus.PAID;
    } else {
      this._status = ParcelStatus.PARTIALLY_PAID;
    }
  }

  checkOverdue() {
    if (this._status !== ParcelStatus.PAID && new Date() > this._dueDate) {
      this._status = ParcelStatus.OVERDUE;
    }
  }
}
