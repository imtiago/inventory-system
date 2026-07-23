import { v4 as uuid } from "uuid";
import { SaleStatus } from "../enums/SaleStatus";
import { SaleItem } from "./SaleItem";

export class Sale {
  private _id: string;
  private _customerId: string;
  private _items: SaleItem[];
  private _totalAmount: number;
  private _status: SaleStatus;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    customerId: string;
    items: SaleItem[];
    status?: SaleStatus;
    createdAt?: Date;
  }) {
    // if (props.items.length === 0) {
    //   throw new Error("Sale must have items");
    // }

    this._id = props.id ?? uuid();

    this._customerId = props.customerId;

    this._items = props.items;

    this._totalAmount = this.calculateTotal();

    this._status = props.status ?? SaleStatus.COMPLETED;

    this._createdAt = props.createdAt ?? new Date();
  }

  private calculateTotal() {
    return this._items.reduce((total, item) => total + item.total, 0);
  }

  get id() {
    return this._id;
  }

  get customerId() {
    return this._customerId;
  }

  get items() {
    return this._items;
  }

  get totalAmount() {
    return this._totalAmount;
  }

  get status() {
    return this._status;
  }

  get createdAt() {
    return this._createdAt;
  }

  cancel() {
    if (this._status === SaleStatus.CANCELLED) {
      throw new Error("Sale already cancelled");
    }

    this._status = SaleStatus.CANCELLED;
  }
}
