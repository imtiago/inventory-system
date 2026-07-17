import { v4 as uuid } from "uuid";
import { PaymentMethod } from "../enums/PaymentMethod";

export class Payment {
  private _id: string;

  private _parcelId: string;

  private _amount: number;

  private _method: PaymentMethod;

  private _paymentDate: Date;

  constructor(props: {
    id?: string;
    parcelId: string;
    amount: number;
    method: PaymentMethod;
    paymentDate?: Date;
  }) {
    this._id = props.id ?? uuid();

    this._parcelId = props.parcelId;

    this._amount = props.amount;

    this._method = props.method;

    this._paymentDate = props.paymentDate ?? new Date();
  }

  get id() {
    return this._id;
  }

  get parcelId() {
    return this._parcelId;
  }

  get amount() {
    return this._amount;
  }

  get method() {
    return this._method;
  }

  get paymentDate() {
    return this._paymentDate;
  }
}
