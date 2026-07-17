import { v4 as uuid } from "uuid";

export class FinancialParcel {
  private _id: string;
  private _amount: number;
  private _dueDate: Date;

  private _paidAt: Date | null;

  constructor(props: {
    id?: string;
    amount: number;
    dueDate: Date;
    paidAt?: Date | null;
  }) {
    this._id = props.id ?? uuid();

    this._amount = props.amount;

    this._dueDate = props.dueDate;

    this._paidAt = props.paidAt ?? null;
  }

  get id() {
    return this._id;
  }

  get amount() {
    return this._amount;
  }

  get dueDate() {
    return this._dueDate;
  }

  get paidAt() {
    return this._paidAt;
  }

  pay(): void {
    this._paidAt = new Date();
  }
}
