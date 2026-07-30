import { BaseEntity } from "@shared/domain/entities/BaseEntity";
import { SaleStatus } from "../enums/SaleStatus";
import { SaleItem } from "./SaleItem";

export class Sale extends BaseEntity {
  private _customerId: string;
  private _items: SaleItem[];
  private _totalAmount: number;
  private _status: SaleStatus;

  constructor(props: {
    id?: string;
    customerId: string;
    items: SaleItem[];
    status?: SaleStatus;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    // if (props.items.length === 0) {
    //   throw new Error("Sale must have items");
    // }

    this._customerId = props.customerId;

    this._items = props.items;

    this._totalAmount = this.calculateTotal();

    this._status = props.status ?? SaleStatus.COMPLETED;
  }

  private calculateTotal() {
    return this._items.reduce((total, item) => total + item.total, 0);
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

  cancel() {
    if (this._status === SaleStatus.CANCELLED) {
      throw new Error("Sale already cancelled");
    }

    this._status = SaleStatus.CANCELLED;
  }
}
