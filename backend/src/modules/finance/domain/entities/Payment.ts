import { v4 as uuid } from "uuid";
import { PaymentMethod } from "../enums/PaymentMethod";

export class Payment {
  private _id: string;

  private _parcelId: string;

  private _reference: string | null;

  private _amount: number;

  private _method: PaymentMethod;

  private _paymentDate: Date;

  constructor(props: {
    id?: string;
    parcelId: string;
    amount: number;
    method: PaymentMethod;
    reference: string | null;
    paymentDate?: Date;
  }) {
    this._id = props.id ?? uuid();

    this._parcelId = props.parcelId;

    this._amount = props.amount;

    this._method = props.method;

    this._reference = props.reference;

    this._paymentDate = props.paymentDate ?? new Date();
    if (props.amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }
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

  get reference() {
    return this._reference;
  }
}
