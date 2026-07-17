// src/modules/sales/domain/entities/Sale.ts

import { v4 as uuid } from "uuid";
import { SaleStatus } from "../enums/SaleStatus";
import { SaleItem } from "./SaleItem";

export class Sale {
  private _id: string;
  private _customerId: string;

  private _items: SaleItem[];

  private _createdAt: Date;

  private _status: SaleStatus;

  constructor(props: {
    id?: string;
    customerId: string;
    items?: SaleItem[];
    createdAt?: Date;
    status?: SaleStatus;
  }) {
    this._id = props.id ?? uuid();

    this._customerId = props.customerId;

    this._items = props.items ?? [];

    this._createdAt = props.createdAt ?? new Date();

    this._status = props.status ?? SaleStatus.PENDING;
  }

  get id(): string {
    return this._id;
  }

  get customerId(): string {
    return this._customerId;
  }

  get items(): SaleItem[] {
    return [...this._items];
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get status(): SaleStatus {
    return this._status;
  }

  get totalAmount(): number {
    return this._items.reduce((total, item) => total + item.totalPrice, 0);
  }

  addItem(item: SaleItem): void {
    if (this._status !== SaleStatus.PENDING) {
      throw new Error("Items can only be added to pending sales.");
    }

    this._items.push(item);
  }

  removeItem(itemId: string): void {
    if (this._status !== SaleStatus.PENDING) {
      throw new Error("Items can only be removed from pending sales.");
    }

    this._items = this._items.filter((item) => item.id !== itemId);
  }

  markAsCompleted(): void {
    if (this._items.length === 0) {
      throw new Error("Cannot complete sale without items.");
    }

    this._status = SaleStatus.COMPLETED;
  }

  markAsCancelled(): void {
    if (this._status === SaleStatus.COMPLETED) {
      throw new Error("Completed sale cannot be cancelled.");
    }

    this._status = SaleStatus.CANCELED;
  }
}
